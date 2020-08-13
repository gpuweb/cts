// Implements the standalone test runner (see also: /standalone/index.html).

import { DefaultTestFileLoader } from '../framework/file_loader.js';
import { Logger } from '../framework/logging/logger.js';
import { parseQuery } from '../framework/query/parseQuery.js';
import { TestQueryLevel } from '../framework/query/query.js';
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

function makeTreeNodeHTML(
  tree: TestTreeNode,
  parentLevel: TestQueryLevel
): [HTMLElement, RunSubtree] {
  if ('children' in tree) {
    return makeSubtreeHTML(tree, parentLevel);
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

  const caselogs = $('<div>').addClass('testcaselogs');
  const casehead = makeTreeNodeHeaderHTML(t, runSubtree, 2, checked => {
    checked ? caselogs.show() : caselogs.hide();
  });
  div.append(casehead);
  const casetime = $('<div>').addClass('testcasetime').html('ms').appendTo(casehead);
  caselogs.appendTo(div);

  return [div[0], runSubtree];
}

function makeSubtreeHTML(n: TestSubtree, parentLevel: TestQueryLevel): [HTMLElement, RunSubtree] {
  const div = $('<div>').addClass('subtree');

  const subtreeHTML = $('<div>').addClass('subtreechildren');
  const runSubtree = makeSubtreeChildrenHTML(subtreeHTML[0], n.children.values(), n.query.level);

  const header = makeTreeNodeHeaderHTML(n, runSubtree, parentLevel, checked => {
    checked ? subtreeHTML.show() : subtreeHTML.hide();
  });

  div.append(header);
  div.append(subtreeHTML);

  div[0].classList.add(['', 'multifile', 'multitest', 'multicase'][n.query.level]);

  return [div[0], runSubtree];
}

function makeSubtreeChildrenHTML(
  div: HTMLElement,
  children: Iterable<TestTreeNode>,
  parentLevel: TestQueryLevel
): RunSubtree {
  const runSubtreeFns: RunSubtree[] = [];
  for (const subtree of children) {
    const [subtreeHTML, runSubtree] = makeTreeNodeHTML(subtree, parentLevel);
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
  n: TestTreeNode,
  runSubtree: RunSubtree,
  parentLevel: TestQueryLevel,
  onChange: (checked: boolean) => void
): HTMLElement {
  const isLeaf = 'run' in n;
  const div = $('<div>').addClass('nodeheader');

  const href = `?${worker ? 'worker&' : ''}${debug ? 'debug&' : ''}q=${n.query.toString()}`;
  if (onChange) {
    const checkbox = $('<input>')
      .attr('type', 'checkbox')
      .addClass('collapsebtn')
      .change(function (this) {
        onChange((this as HTMLInputElement).checked);
      })
      .attr('alt', 'Expand')
      .attr('title', 'Expand')
      .appendTo(div);

    // Collapse s:f:* or s:f:t:* or s:f:t:c by default.
    if (n.query.level > rootQueryLevel && n.query.level > parentLevel) {
      onChange(false);
    } else {
      checkbox.prop('checked', true); // (does not fire onChange)
    }
  }
  const runtext = isLeaf ? 'Run case' : 'Run subtree';
  $('<button>')
    .addClass(isLeaf ? 'leafrun' : 'subtreerun')
    .attr('alt', runtext)
    .attr('title', runtext)
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
  const nodename = $('<span>')
    .addClass('nodename')
    .text(n.readableRelativeName)
    .appendTo(nodetitle);
  if ('run' in n) {
    nodename.addClass('leafname');
  }
  $('<input>')
    .attr('type', 'text')
    .prop('readonly', true)
    .addClass('nodequery')
    .val(n.query.toString())
    .appendTo(nodetitle);
  if ('description' in n && n.description) {
    $('<pre>') //
      .addClass('nodedescription')
      .text(n.description)
      .appendTo(nodetitle);
  }
  return div[0];
}

function updateJSON(): void {
  resultsJSON.textContent = logger.asJSON(2);
}

let rootQueryLevel: TestQueryLevel = 1;

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
  const rootQuery = parseQuery(qs[0]);
  rootQueryLevel = rootQuery.level;
  const tree = await loader.loadTree(rootQuery);

  tree.dissolveLevelBoundaries();

  const [el, runSubtree] = makeSubtreeHTML(tree.root, 1);
  resultsVis.append(el);

  $('#expandall').change(function (this) {
    const checked = (this as HTMLInputElement).checked;
    $('.collapsebtn').prop('checked', checked).trigger('change');
  });

  if (runnow) {
    runSubtree();
  }
})();
