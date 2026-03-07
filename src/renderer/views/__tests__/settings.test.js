const { setupRefreshClick, appendRendererLog } = require('../settings.js');

describe('settings refresh flow', () => {
  beforeEach(() => {
    document.body.innerHTML = [
      '<button id="refreshOrderList" data-action="refresh-order-list">Refresh</button>',
      '<details id="debugDetails"><summary>Debug</summary><pre id="debugLog"></pre></details>',
      '<div id="orderListEmpty"></div><ul id="orderList"></ul>',
    ].join('');
  });

  test('clicking Refresh appends message to debug log and calls getOrderListFn', () => {
    const getOrderListFn = jest.fn().mockResolvedValue({ orders: [] });
    const debugLogEl = document.getElementById('debugLog');
    const debugDetailsEl = document.getElementById('debugDetails');

    setupRefreshClick(getOrderListFn, { debugLogEl, debugDetailsEl });

    const btn = document.querySelector('[data-action="refresh-order-list"]');
    btn.click();

    expect(debugLogEl.innerHTML).toContain('Order list refresh requested');
    expect(getOrderListFn).toHaveBeenCalled();
  });

  test('appendRendererLog adds message to container', () => {
    const container = document.createElement('div');
    appendRendererLog(container, 'test message');
    expect(container.innerHTML).toContain('test message');
    expect(container.querySelector('.line.log')).toBeTruthy();
  });
});
