/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {getDomSubtree} from '../../src/tools/dom.js';
import {clickBySelector, fillBySelector} from '../../src/tools/input.js';
import {html, withMcpContext} from '../utils.js';

describe('get_dom_subtree', () => {
  it('returns nested children for a list element', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(
        html`<ul id="list"><li>a</li><li>b</li></ul>`,
      );

      await getDomSubtree.handler(
        {params: {selector: '#list'}, page: context.getSelectedMcpPage()},
        response,
        context,
      );

      const json = JSON.parse(
        response.responseLines
          .filter(l => l !== '```json' && l !== '```')
          .join('\n'),
      );
      assert.strictEqual(json.tag, 'ul');
      assert.strictEqual(json.children?.length, 2);
      assert.strictEqual((json.children as Array<{tag: string}>)[0].tag, 'li');
    });
  });

  it('limits depth when maxDepth is specified', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(
        html`<div id="root"><div class="level1"><div class="level2"><span>deep</span></div></div></div>`,
      );

      await getDomSubtree.handler(
        {
          params: {selector: '#root', maxDepth: 1},
          page: context.getSelectedMcpPage(),
        },
        response,
        context,
      );

      const json = JSON.parse(
        response.responseLines
          .filter(l => l !== '```json' && l !== '```')
          .join('\n'),
      );
      assert.strictEqual(json.tag, 'div');
      assert.ok(!json.children, 'should not have children at maxDepth=1');
    });
  });

  it('returns text content at leaf node', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<p id="para">hello world</p>`);

      await getDomSubtree.handler(
        {params: {selector: '#para'}, page: context.getSelectedMcpPage()},
        response,
        context,
      );

      const json = JSON.parse(
        response.responseLines
          .filter(l => l !== '```json' && l !== '```')
          .join('\n'),
      );
      assert.strictEqual(json.text, 'hello world');
    });
  });

  it('throws when no element matches the selector', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<div>page</div>`);

      await assert.rejects(
        () =>
          getDomSubtree.handler(
            {
              params: {selector: '#ghost'},
              page: context.getSelectedMcpPage(),
            },
            response,
            context,
          ),
        (err: Error) => {
          assert.ok(err.message.includes('No element found'));
          return true;
        },
      );
    });
  });
});

describe('click_by_selector', () => {
  it('clicks an element matching the selector', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(
        html`<button onclick="this.id='done'">click me</button>`,
      );

      await clickBySelector.handler(
        {
          params: {selector: 'button'},
          page: context.getSelectedMcpPage(),
        },
        response,
        context,
      );

      assert.ok(response.responseLines[0].includes('Successfully clicked'));
      assert.ok(await page.$('#done'), 'button id should be set after click');
    });
  });

  it('double clicks when dblClick is true', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(
        html`<div ondblclick="this.id='done'">double click me</div>`,
      );

      await clickBySelector.handler(
        {
          params: {selector: 'div', dblClick: true},
          page: context.getSelectedMcpPage(),
        },
        response,
        context,
      );

      assert.ok(
        response.responseLines[0].includes('Successfully double clicked'),
      );
      assert.ok(await page.$('#done'), 'id should be set after double click');
    });
  });

  it('throws when selector matches no element', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<div>page</div>`);

      await assert.rejects(
        () =>
          clickBySelector.handler(
            {
              params: {selector: '#ghost'},
              page: context.getSelectedMcpPage(),
            },
            response,
            context,
          ),
        (err: Error) => {
          assert.ok(err.message.includes('No element found'));
          return true;
        },
      );
    });
  });
});

describe('fill_by_selector', () => {
  it('fills a text input with the given value', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<input id="name" type="text" />`);

      await fillBySelector.handler(
        {
          params: {selector: '#name', value: 'hello'},
          page: context.getSelectedMcpPage(),
        },
        response,
        context,
      );

      assert.ok(response.responseLines[0].includes('Successfully filled'));
      const value = await page.evaluate(
        () => (document.querySelector('#name') as HTMLInputElement).value,
      );
      assert.strictEqual(value, 'hello');
    });
  });

  it('throws when the element is disabled', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<input id="locked" type="text" disabled />`);

      await assert.rejects(
        () =>
          fillBySelector.handler(
            {
              params: {selector: '#locked', value: 'test'},
              page: context.getSelectedMcpPage(),
            },
            response,
            context,
          ),
        (err: Error) => {
          assert.ok(err.message.includes('disabled'));
          return true;
        },
      );
    });
  });

  it('throws when the element is read-only', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<input id="ro" type="text" readonly />`);

      await assert.rejects(
        () =>
          fillBySelector.handler(
            {
              params: {selector: '#ro', value: 'test'},
              page: context.getSelectedMcpPage(),
            },
            response,
            context,
          ),
        (err: Error) => {
          assert.ok(err.message.includes('read-only'));
          return true;
        },
      );
    });
  });

  it('throws when selector matches no element', async () => {
    await withMcpContext(async (response, context) => {
      const page = context.getSelectedPptrPage();
      await page.setContent(html`<div>page</div>`);

      await assert.rejects(
        () =>
          fillBySelector.handler(
            {
              params: {selector: '#ghost', value: 'test'},
              page: context.getSelectedMcpPage(),
            },
            response,
            context,
          ),
        (err: Error) => {
          assert.ok(err.message.includes('No element found'));
          return true;
        },
      );
    });
  });
});
