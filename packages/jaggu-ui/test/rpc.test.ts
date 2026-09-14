import { describe, it, expect } from 'vitest';
import { isValidWebviewMessage, isValidExtensionMessage } from '../src/types/rpc.js';

describe('RPC Message Validation', () => {
  describe('WebviewToExtensionMessage Validator', () => {
    it('should accept valid user.submit message', () => {
      const validMsg = {
        type: 'user.submit',
        payload: {
          id: 'msg_1',
          text: 'Refactor error handling',
          timestamp: Date.now(),
        },
      };
      expect(isValidWebviewMessage(validMsg)).toBe(true);
    });

    it('should accept valid agent.cancel message', () => {
      expect(isValidWebviewMessage({ type: 'agent.cancel', payload: {} })).toBe(true);
      expect(isValidWebviewMessage({ type: 'agent.cancel' })).toBe(true);
    });

    it('should accept valid ui.ready and ui.clear messages', () => {
      expect(isValidWebviewMessage({ type: 'ui.ready', payload: { timestamp: Date.now() } })).toBe(true);
      expect(isValidWebviewMessage({ type: 'ui.clear', payload: {} })).toBe(true);
    });

    it('should reject non-object payloads', () => {
      expect(isValidWebviewMessage(null)).toBe(false);
      expect(isValidWebviewMessage(undefined)).toBe(false);
      expect(isValidWebviewMessage('string-msg')).toBe(false);
      expect(isValidWebviewMessage(12345)).toBe(false);
    });

    it('should reject messages with unknown type', () => {
      expect(isValidWebviewMessage({ type: 'unknown.action', payload: {} })).toBe(false);
    });

    it('should reject malformed user.submit missing text or id', () => {
      expect(isValidWebviewMessage({ type: 'user.submit', payload: { id: '1' } })).toBe(false);
      expect(isValidWebviewMessage({ type: 'user.submit', payload: { text: 'hello' } })).toBe(false);
      expect(isValidWebviewMessage({ type: 'user.submit', payload: 'not-an-object' })).toBe(false);
    });
  });

  describe('ExtensionToWebviewMessage Validator', () => {
    it('should accept valid agent.status message', () => {
      const statusMsg = {
        type: 'agent.status',
        payload: { state: 'PROCESSING', detail: 'Running tests' },
      };
      expect(isValidExtensionMessage(statusMsg)).toBe(true);
    });

    it('should accept valid agent.message and agent.error', () => {
      const chatMsg = {
        type: 'agent.message',
        payload: { id: 'asst_1', role: 'assistant', text: 'Hello', timestamp: Date.now() },
      };
      expect(isValidExtensionMessage(chatMsg)).toBe(true);

      const errorMsg = {
        type: 'agent.error',
        payload: { code: 'FAIL', message: 'Something went wrong' },
      };
      expect(isValidExtensionMessage(errorMsg)).toBe(true);
    });

    it('should reject unrecognized extension messages', () => {
      expect(isValidExtensionMessage({ type: 'unknown.event' })).toBe(false);
      expect(isValidExtensionMessage(null)).toBe(false);
    });
  });
});
