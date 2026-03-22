/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

const selectorSchema = zod
  .string()
  .describe('A CSS selector to identify the target element.');

export const getDomSubtree = definePageTool({
  name: 'get_dom_subtree',
  description: `Return the DOM subtree rooted at the element matching the given CSS selector as structured JSON. Useful for inspecting table, form, or component structures without retrieving the full page.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    selector: selectorSchema,
    maxDepth: zod
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe(
        'Maximum depth of the subtree to return (default: 10). Lower values reduce token usage.',
      ),
  },
  handler: async (request, response) => {
    const {selector, maxDepth = 10} = request.params;
    const page = request.page.pptrPage;

    const result = await page.evaluate(
      (sel: string, depth: number) => {
        const root = document.querySelector(sel);
        if (!root) {
          return null;
        }

        function serialize(node: Element, currentDepth: number): object {
          const attrs = Object.fromEntries(
            Array.from(node.attributes)
              .filter(a => !['id', 'class'].includes(a.name))
              .map(a => [a.name, a.value]),
          );

          const entry: Record<string, unknown> = {
            tag: node.tagName.toLowerCase(),
          };
          if (node.id) {
            entry['id'] = node.id;
          }
          if (node.className) {
            entry['class'] = node.className;
          }
          if (Object.keys(attrs).length > 0) {
            entry['attributes'] = attrs;
          }

          if (currentDepth <= 1 || node.children.length === 0) {
            const text = node.textContent?.trim();
            if (text) {
              entry['text'] = text;
            }
          } else {
            entry['children'] = Array.from(node.children).map(child =>
              serialize(child, currentDepth - 1),
            );
          }

          return entry;
        }

        return serialize(root, depth);
      },
      selector,
      maxDepth,
    );

    if (!result) {
      throw new Error(
        `No element found for selector "${selector}". Verify the selector or use take_snapshot to inspect the page structure.`,
      );
    }

    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});
