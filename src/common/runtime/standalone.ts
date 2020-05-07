// Implements the standalone test runner (see also: /standalone/index.html).

import { TestLoader } from '../framework/loader.js';
import { Logger } from '../framework/logging/logger.js';
import { RunCase } from '../framework/test_group.js';
import { FilterResultTreeNode } from '../framework/tree.js';
import { encodeSelectively } from '../framework/url_query.js';
import { assert } from '../framework/util/util.js';

import { optionEnabled } from './helper/options.js';
import { TestWorker } from './helper/test_worker.js';

window.onbeforeunload = () => {
  // Prompt user before reloading if there are any results
  return haveSomeResults ? false : undefined;
};

let haveSomeResults = false;

const runnow = optionEnabled('runnow');
const debug = optionEnabled('debug');

const logger = new Logger(debug);

const worker = optionEnabled('worker') ? new TestWorker() : undefined;

const resultsVis = document.getElementById('resultsVis')!;
const resultsJSON = document.getElementById('resultsJSON')!;

type RunSubtree = () => Promise<void>;

// DOM generation

function makeTreeNodeHTML(name: string, tree: FilterResultTreeNode): [HTMLElement, RunSubtree] {
  if ('children' in tree) {
    return makeSubtreeHTML(name, tree);
  } else {
    return makeCaseHTML(name, tree.runCase!);
  }
}

function makeCaseHTML(name: string, t: RunCase): [HTMLElement, RunSubtree] {
  const div = $('<div>').addClass('testcase');

  const runSubtree = async () => {
    haveSomeResults = true;
    const [rec, res] = logger.record(name);
    if (worker) {
      const workerResult = await worker.run(name, debug);
      Object.assign(res, workerResult);
    } else {
      await t.run(rec);
    }

    casetime.text(res.timems.toFixed(4) + ' ms');

    div.attr('data-status', res.status);

    if (res.logs) {
      caselogs.empty();
      for (const l of res.logs) {
        const caselog = $('<div>').addClass('testcaselog').appendTo(caselogs);
        $('<button>')
          .addClass('testcaselogbtn')
          .attr('alt', 'Log stack to console')
          .attr('title', 'Log stack to console')
          .appendTo(caselog)
          .on('click', () => {
            /* eslint-disable-next-line no-console */
            console.log(l);
          });
        $('<pre>').addClass('testcaselogtext').appendTo(caselog).text(l.toJSON());
      }
    }
  };

  const casehead = makeTreeNodeHeaderHTML(name, undefined, runSubtree);
  div.append(casehead);
  const casetime = $('<div>').addClass('testcasetime').html('ms').appendTo(casehead);
  const caselogs = $('<div>').addClass('testcaselogs').appendTo(div);

  return [div[0], runSubtree];
}

function makeSubtreeHTML(name: string, subtree: FilterResultTreeNode): [HTMLElement, RunSubtree] {
  const div = $('<div>').addClass('subtree');

  const header = makeTreeNodeHeaderHTML(name, subtree.description, () => {
    return runSubtree();
  });
  div.append(header);

  const subtreeHTML = $('<div>').addClass('subtreechildren').appendTo(div);
  const runSubtree = makeSubtreeChildrenHTML(subtreeHTML[0], subtree.children!);

  return [div[0], runSubtree];
}

function makeSubtreeChildrenHTML(
  div: HTMLElement,
  children: Map<string, FilterResultTreeNode>
): RunSubtree {
  const runSubtreeFns: RunSubtree[] = [];
  for (const [name, subtree] of children) {
    const [subtreeHTML, runSubtree] = makeTreeNodeHTML(name, subtree);
    div.append(subtreeHTML);
    runSubtreeFns.push(runSubtree);
  }

  return async () => {
    for (const runSubtree of runSubtreeFns) {
      await runSubtree();
    }
  };
}

function makeTreeNodeHeaderHTML(
  name: string,
  description: string | undefined,
  runSubtree: RunSubtree
): HTMLElement {
  const div = $('<div>').addClass('nodeheader');

  const nameEncoded = encodeSelectively(name);
  let nameHTML;
  {
    const i = nameEncoded.indexOf('{');
    const n1 = i === -1 ? nameEncoded : nameEncoded.slice(0, i + 1);
    const n2 = i === -1 ? '' : nameEncoded.slice(i + 1);
    nameHTML = n1.replace(/:/g, ':<wbr>') + '<wbr>' + n2.replace(/,/g, ',<wbr>');
  }

  const href = `?${worker ? 'worker&' : ''}${debug ? 'debug&' : ''}q=${nameEncoded}`;
  $('<button>')
    .addClass('noderun')
    .attr('alt', 'Run subtree')
    .attr('title', 'Run subtree')
    .on('click', async () => {
      await runSubtree();
      updateJSON();
    })
    .appendTo(div);
  $('<a>')
    .addClass('nodelink')
    .attr('href', href)
    .attr('alt', 'Open')
    .attr('title', 'Open')
    .appendTo(div);
  const nodetitle = $('<div>').addClass('nodetitle').appendTo(div);
  $('<span>').addClass('nodename').html(nameHTML).appendTo(nodetitle);
  if (description) {
    $('<div>')
      .addClass('nodedescription')
      .html(description.replace(/\n/g, '<br>'))
      .appendTo(nodetitle);
  }
  return div[0];
}

function updateJSON(): void {
  resultsJSON.textContent = logger.asJSON(2);
}

(async () => {
  const loader = new TestLoader();

  // TODO: start populating page before waiting for everything to load?
  const qs = new URLSearchParams(window.location.search).getAll('q');
  assert(qs.length === 1, 'currently, there must be exactly one ?q=');
  const files = await loader.loadTests(qs[0]);
  const tree = treeFromFilterResults(logger, files);

  const runSubtree = makeSubtreeChildrenHTML(resultsVis, tree.children!);

  if (runnow) {
    runSubtree();
  }
})();
