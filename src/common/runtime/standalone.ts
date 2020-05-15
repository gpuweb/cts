// Implements the standalone test runner (see also: /standalone/index.html).

import { DefaultTestFileLoader } from '../framework/file_loader.js';
import { Logger } from '../framework/logging/logger.js';
import { TestQuery } from '../framework/query/query.js';
import { TestTreeNode, TestSubtree, TestTreeLeaf } from '../framework/tree.js';
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

const worker = optionEnabled('worker') ? new TestWorker(debug) : undefined;

const resultsVis = document.getElementById('resultsVis')!;
const resultsJSON = document.getElementById('resultsJSON')!;

type RunSubtree = () => Promise<void>;

// DOM generation

function makeTreeNodeHTML(tree: TestTreeNode): [HTMLElement, RunSubtree] {
  if ('children' in tree) {
    return makeSubtreeHTML(tree);
  } else {
    return makeCaseHTML(tree);
  }
}

function makeCaseHTML(t: TestTreeLeaf): [HTMLElement, RunSubtree] {
  const div = $('<div>').addClass('testcase');

  const name = t.query.toString();
  const runSubtree = async () => {
    haveSomeResults = true;
    const [rec, res] = logger.record(name);
    if (worker) {
      await worker.run(rec, name);
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

  const casehead = makeTreeNodeHeaderHTML(t.query, undefined, runSubtree, true);
  div.append(casehead);
  const casetime = $('<div>').addClass('testcasetime').html('ms').appendTo(casehead);
  const caselogs = $('<div>').addClass('testcaselogs').appendTo(div);

  return [div[0], runSubtree];
}

function makeSubtreeHTML(t: TestSubtree): [HTMLElement, RunSubtree] {
  const div = $('<div>').addClass('subtree');

  const header = makeTreeNodeHeaderHTML(t.query, t.description, () => runSubtree(), false);
  div.append(header);

  const subtreeHTML = $('<div>').addClass('subtreechildren').appendTo(div);
  const runSubtree = makeSubtreeChildrenHTML(subtreeHTML[0], t.children.values());

  return [div[0], runSubtree];
}

function makeSubtreeChildrenHTML(div: HTMLElement, children: Iterable<TestTreeNode>): RunSubtree {
  const runSubtreeFns: RunSubtree[] = [];
  for (const subtree of children) {
    const [subtreeHTML, runSubtree] = makeTreeNodeHTML(subtree);
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
  query: TestQuery,
  description: string | undefined,
  runSubtree: RunSubtree,
  isLeaf: boolean
): HTMLElement {
  const div = $('<div>').addClass('nodeheader');

  const href = `?${worker ? 'worker&' : ''}${debug ? 'debug&' : ''}q=${query.toString()}`;
  $('<button>')
    .addClass(isLeaf ? 'leafrun' : 'subtreerun')
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
  $('<span>').addClass('nodename').html(query.toHTML()).appendTo(nodetitle);
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
  const loader = new DefaultTestFileLoader();

  // TODO: start populating page before waiting for everything to load?
  const qs = new URLSearchParams(window.location.search).getAll('q');
  if (qs.length === 0) {
    qs.push('webgpu:*');
  }

  // Update the URL bar to match the exact current options.
  {
    let url = window.location.protocol + '//' + window.location.host + window.location.pathname;
    url +=
      '?' +
      new URLSearchParams([
        ['runnow', runnow ? '1' : '0'],
        ['worker', worker ? '1' : '0'],
        ['debug', debug ? '1' : '0'],
      ]).toString() +
      '&' +
      qs.map(q => 'q=' + q).join('&');
    window.history.replaceState(null, '', url);
  }

  assert(qs.length === 1, 'currently, there must be exactly one ?q=');
  const tree = await loader.loadTree(qs[0]);

  const [el, runSubtree] = makeSubtreeHTML(tree.root);
  resultsVis.append(el);

  if (runnow) {
    runSubtree();
  }
})();
