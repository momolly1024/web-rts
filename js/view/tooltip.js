// 指令按鈕的浮動說明框：滑鼠移到（或焦點落在）帶 detail 的按鈕上時顯示，內容每幀更新。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var GAP = 8;

  function create(actionsBox, box) {
    var hovered = null;

    function track(ev) {
      var button = ev.target.closest('button');
      hovered = button ? button.dataset.id : null;
    }
    function clear() { hovered = null; box.hidden = true; }

    actionsBox.addEventListener('mouseover', track);
    actionsBox.addEventListener('mouseleave', clear);
    actionsBox.addEventListener('focusin', track);

    // 放在按鈕正上方，左右不超出視窗
    function place(button) {
      var r = button.getBoundingClientRect();
      var left = Math.min(r.left, window.innerWidth - box.offsetWidth - GAP);
      box.style.left = Math.max(GAP, left) + 'px';
      box.style.bottom = (window.innerHeight - r.top + GAP) + 'px';
    }

    // actions 與 actionsBox 的子元素一一對應
    function update(actions) {
      var index = -1;
      actions.forEach(function (a, i) { if (a.id === hovered && a.detail && !a.hidden) index = i; });
      if (index < 0) { box.hidden = true; return; }
      var content = actions[index].detail().join('\n');
      if (box.textContent !== content) box.textContent = content;
      box.hidden = false;
      place(actionsBox.children[index]);
    }

    return { update: update, clear: clear };
  }

  RTS.tooltip = { create: create };
})();
