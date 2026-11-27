// 各文明的建築風格：牆面色調與屋頂形狀。屋頂或其裝飾一定帶隊色，才分得出敵我。
// 繪圖工具由 sprites-buildings.js 以 draw = { face, edge, box } 傳入。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var THATCH = '#d9b44a', THATCH_DARK = '#b08c2e';

  function mix(a, b, k) {
    var out = '#';
    for (var i = 1; i < 6; i += 2) {
      var v = Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }

  // 牆面往文明色調靠；隊色與非 #rrggbb 的顏色不動
  function tint(style, color) {
    var isTeam = RTS.data.players.some(function (p) { return p.color === color || p.dark === color; });
    return !style || isTeam || !/^#[0-9a-f]{6}$/i.test(color) ? color : mix(color, style.wall, style.amount);
  }

  function corners(r, z) {
    return [[r[0], r[1], z], [r[2], r[1], z], [r[2], r[3], z], [r[0], r[3], z]];
  }

  // 以曲線收到頂點的圓頂：沿高度疊幾層逐漸內縮的四角環
  function dome(draw, r, z, rise, color, shade) {
    var steps = [[0, 0], [0.45, 0.14], [0.78, 0.34], [0.96, 0.62], [1, 1]];
    var cu = (r[0] + r[2]) / 2, cv = (r[1] + r[3]) / 2;
    function ring(i) {
      var k = steps[i][0], s = 1 - steps[i][1];
      return corners([cu + (r[0] - cu) * s, cv + (r[1] - cv) * s, cu + (r[2] - cu) * s, cv + (r[3] - cv) * s], z + rise * k);
    }
    for (var i = 0; i < steps.length - 1; i++) {
      var low = ring(i), high = ring(i + 1);
      [[0, 1, shade], [3, 0, color], [2, 3, color], [1, 2, shade]].forEach(function (side) {
        draw.face([low[side[0]], low[side[1]], high[side[1]], high[side[0]]], side[2], false);
      });
    }
  }

  // 平屋頂加垛口，頂面用隊色
  function keep(draw, r, z, rise, c) {
    var top = z + Math.min(0.32, rise);
    draw.box(r, z, top, ['#8d949c', '#6f767e', c.color]);
    var us = [r[0], (r[0] + r[2]) / 2, r[2]], vs = [r[1], (r[1] + r[3]) / 2, r[3]];
    [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(function (p) {
      var u = Math.min(r[2] - 0.1, Math.max(r[0] + 0.1, us[p[0]])), v = Math.min(r[3] - 0.1, Math.max(r[1] + 0.1, vs[p[1]]));
      draw.box([u - 0.09, v - 0.09, u + 0.09, v + 0.09], top, top + 0.2, ['#a3abb3', '#7f868e', '#b6bdc4']);
    });
  }

  var STYLES = {
    // 蒼林：木造牆面、陡斜屋頂、綠色簷板
    greenwood: {
      wall: '#7b5a34', amount: 0.45,
      gable: function (draw, r, z, rise, roof, shade, wall, basic) {
        var mid = (r[1] + r[3]) / 2, top = z + rise * 1.3;
        basic(r, z, rise * 1.3, roof, shade, wall);
        draw.edge([r[0], r[3], z], [r[2], r[3], z], '#3f7a36', 0.14);
        draw.edge([r[2], r[3], z], [r[2], mid, top], '#3f7a36', 0.12);
        draw.edge([r[0], mid, top], [r[2], mid, top], '#7fbf5a', 0.1);
      },
      spire: function (draw, r, z, rise, c, basic) {
        basic(r, z, rise * 1.2, c.color, c.dark);
        var mid = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2, z + rise * 1.2];
        draw.edge([r[0], r[3], z], [r[2], r[3], z], '#3f7a36', 0.12);
        draw.edge([r[2], r[3], z], mid, '#7fbf5a', 0.08);
      }
    },
    // 鐵岩：冷灰石牆、平頂城垛
    ironrock: {
      wall: '#7e8893', amount: 0.6, symmetric: true,
      gable: function (draw, r, z, rise, roof, shade) { keep(draw, r, z, rise, { color: roof, dark: shade }); },
      spire: function (draw, r, z, rise, c) { keep(draw, r, z, rise, c); }
    },
    // 金原：沙色牆面、茅草圓頂，簷口隊色寬帶與頂飾
    goldplain: {
      wall: '#e2c276', amount: 0.4, symmetric: true,
      gable: function (draw, r, z, rise, roof) { thatched(draw, r, z, rise, roof); },
      spire: function (draw, r, z, rise, c) { thatched(draw, r, z, rise, c.color); }
    }
  };

  function thatched(draw, r, z, rise, team) {
    draw.box(r, z, z + 0.2, [team, team, THATCH_DARK]);
    dome(draw, r, z + 0.2, rise * 0.9, THATCH, THATCH_DARK);
    var u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2, top = z + 0.2 + rise * 0.9;
    draw.box([u - 0.1, v - 0.1, u + 0.1, v + 0.1], top - 0.05, top + 0.14, [team, team, team]);
  }

  RTS.civStyle = { of: function (civ) { return STYLES[civ] || null; }, tint: tint, mix: mix };
})();
