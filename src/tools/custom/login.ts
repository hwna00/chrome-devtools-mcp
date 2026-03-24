/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {zod} from '../../third_party/index.js';

import {ToolCategory} from '../categories.js';
import {definePageTool} from '../ToolDefinition.js';

const SELECTORS = {
  container: 'div.form',
  com_code: 'div.form input[name="com_code"]',
  id: 'div.form input[name="id"]',
  password: 'div.form input[name="passwd"]',
  submit:
    'div.form button[type="submit"], div.form input[type="submit"], div.form .login-btn',
};

export const login = definePageTool({
  name: 'login',
  description: `Fill and submit a login form within div.form. Combines multiple fill and click operations into a single call to reduce token usage. Targets the company login page with com_code, id, and password fields.`,
  annotations: {
    category: ToolCategory.CUSTOM,
    readOnlyHint: false,
  },
  schema: {
    com_code: zod.string().describe('Company code (6 digits)'),
    id: zod.string().describe('User ID'),
    password: zod.string().describe('Password'),
    submit: zod
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to click the submit button after filling'),
  },
  handler: async (request, response, context) => {
    const {com_code, id, password, submit} = request.params;
    const page = request.page.pptrPage;

    const containerExists = await page.evaluate((sel: string) => {
      return document.querySelector(sel) !== null;
    }, SELECTORS.container);

    if (!containerExists) {
      throw new Error(
        `Login form container "${SELECTORS.container}" not found on the page. Use take_snapshot or get_dom_subtree to inspect the page structure.`,
      );
    }

    const fillTimeout = page.getDefaultTimeout() + 500;

    await page
      .locator(SELECTORS.com_code)
      .setTimeout(fillTimeout)
      .fill(com_code);
    response.appendResponseLine(
      `Filled com_code field with the provided value`,
    );

    await page.locator(SELECTORS.id).setTimeout(fillTimeout).fill(id);
    response.appendResponseLine(`Filled id field with the provided value`);

    await page
      .locator(SELECTORS.password)
      .setTimeout(fillTimeout)
      .fill(password);
    response.appendResponseLine(
      `Filled password field with the provided value`,
    );

    if (submit) {
      const submitExists = await page.evaluate((sel: string) => {
        return document.querySelector(sel) !== null;
      }, SELECTORS.submit);

      if (!submitExists) {
        throw new Error(
          `Submit button not found with selector "${SELECTORS.submit}". Use click_by_selector to manually click the correct button.`,
        );
      }

      await context.waitForEventsAfterAction(async () => {
        await page.click(SELECTORS.submit);
      });
      response.appendResponseLine(`Clicked submit button`);
    }

    response.includeSnapshot();
  },
});
