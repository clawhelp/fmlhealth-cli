#!/usr/bin/env node
/**
 * fmlhealth-cli — 一家检 命令行工具
 *
 * 用法:
 *   fmlhealth-cli members                       — 列出家庭成员
 *   fmlhealth-cli health <name>                 — 健康摘要
 *   fmlhealth-cli tests <name> [indicator]      — 自测记录
 *   fmlhealth-cli test-add <name> <indicator> <value> [diastolic]  — 录入
 *   fmlhealth-cli test-delete <name> <indicator> [count]  — 删除最近 N 条自测记录（默认 1 条）
 *   fmlhealth-cli trend <name> <indicator>      — 趋势分析
 *   fmlhealth-cli checkin [name]                — 打卡状态
 *   fmlhealth-cli analyze <name>                — 健康分析
   *   fmlhealth-cli auth login                    — 授权登录（支付宝/微信）
 *   fmlhealth-cli +me                           — 查看当前登录身份
 */

'use strict';

const http = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_URL = 'https://www.fmlhealth.cn';
const CONFIG_DIR = path.join(os.homedir(), '.fmlhealth-cli');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');

function getSavedToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).token;
    }
  } catch (_) {}
  return null;
}

function saveToken(token) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, savedAt: new Date().toISOString() }));
}

function getToken() {
  const saved = getSavedToken();
  if (saved) return saved;
  const env = process.env.YJ_API_KEY || process.env.MCP_API_KEY
  if (env) { saveToken(env); return env; }
  return null;
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const options = {
      hostname: 'www.fmlhealth.cn',
      port: 443,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const VALID_INDICATORS = ['收缩压', '舒张压', '空腹血糖', '餐后2小时血糖', '体重', 'BMI', '心率', '血氧', '体温'];
const INDICATOR_ALIASES = {
  '餐后2h血糖': '餐后2小时血糖',
  '餐后血糖': '餐后2小时血糖',
  '饭后血糖': '餐后2小时血糖',
  '空腹血糖': '空腹血糖',
  '空腹糖': '空腹血糖',
};

const commands = {
  members: async () => {
    const r = await request('GET', '/members');
    console.log(JSON.stringify(r.body, null, 2));
  },
  health: async (name) => {
    const r = await request('GET', '/members');
    const members = r.body || [];
    const m = members.find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到成员: ${name}` })); process.exit(1); }
    const hs = await request('GET', `/health-summary/${m.id}`);
    console.log(JSON.stringify(hs.body, null, 2));
  },
  tests: async (name, indicator) => {
    const r = await request('GET', '/members');
    const m = (r.body || []).find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到: ${name}` })); process.exit(1); }
    const s = await request('GET', `/self-test?member_id=${m.id}`);
    let results = s.body || [];
    if (indicator) results = results.filter(x => x.name === indicator);
    console.log(JSON.stringify(results.slice(0, 20), null, 2));
  },
  'test-add': async (name, indicator, value, diastolic) => {
    const r = await request('GET', '/members');
    const m = (r.body || []).find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到: ${name}` })); process.exit(1); }
    if (indicator && !VALID_INDICATORS.includes(indicator)) {
      // 别名映射
      const aliased = INDICATOR_ALIASES[indicator];
      if (aliased) {
        indicator = aliased;
      } else {
        // 模糊匹配：找包含关系
        const fuzzy = VALID_INDICATORS.filter(v => v.includes(indicator) || indicator.includes(v));
        if (fuzzy.length === 1) {
          indicator = fuzzy[0];
        } else if (fuzzy.length > 1) {
          console.log(JSON.stringify({ error: `"${indicator}" 指标名不明确，你要录入的是哪个？`, candidates: fuzzy }));
          process.exit(1);
        } else {
          console.log(JSON.stringify({ warning: `"${indicator}" 不在已知指标列表中，确定要录入吗？`, requires_confirmation: true, indicator, value, valid: VALID_INDICATORS }));
          process.exit(1);
        }
      }
    }
    if (diastolic) {
      const bp = await request('POST', '/self-test/blood-pressure', { member_id: m.id, systolic: parseFloat(value), diastolic: parseFloat(diastolic) });
      console.log(JSON.stringify(bp.body));
    } else {
      const st = await request('POST', '/self-test', { member_id: m.id, name: indicator, value: parseFloat(value) });
      console.log(JSON.stringify(st.body));
    }
  },
  'test-delete': async (name, indicator, count) => {
    if (!indicator) { console.log(JSON.stringify({ error: '用法: fmlhealth-cli test-delete <姓名> <指标名> [删除条数]' })); process.exit(1); }
    const r = await request('GET', '/members');
    const m = (r.body || []).find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到: ${name}` })); process.exit(1); }
    const limit = parseInt(count, 10);
    if (count && (!limit || limit < 1)) { console.log(JSON.stringify({ error: '删除条数必须是正整数' })); process.exit(1); }
    const del = await request('DELETE', `/self-test?member_id=${m.id}&name=${encodeURIComponent(indicator)}${limit ? '&limit=' + limit : '&limit=1'}`);
    console.log(JSON.stringify(del.body));
  },
  trend: async (name, indicator) => {
    const r = await request('GET', '/members');
    const m = (r.body || []).find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到: ${name}` })); process.exit(1); }
    const t = await request('GET', `/self-test/trend?member_id=${m.id}&name=${encodeURIComponent(indicator)}`);
    const vals = (t.body?.data || t.body || []).map(x => x.value).filter(v => v != null);
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 0;
    console.log(JSON.stringify({
      indicator, count: vals.length, latest: vals[vals.length-1], average: parseFloat(avg),
      unit: (t.body?.data?.[0] || t.body?.[0] || {}).unit,
    }, null, 2));
  },
  checkin: async (name) => {
    if (name) {
      const r = await request('GET', '/checkin/family-status');
      const m = (r.body.members || []).find(x => x.name === name);
      console.log(JSON.stringify(m || { error: `未找到: ${name}` }, null, 2));
    } else {
      const r = await request('GET', '/checkin/family-status');
      console.log(JSON.stringify(r.body, null, 2));
    }
  },
  analyze: async (name) => {
    const r = await request('GET', '/members');
    const m = (r.body || []).find(x => x.name === name);
    if (!m) { console.log(JSON.stringify({ error: `未找到: ${name}` })); process.exit(1); }
    const reports = await request('GET', `/members/${m.id}/reports`);
    const latestReport = (reports.body || []).sort((a,b) => (b.id||0)-(a.id||0))[0];
    if (!latestReport) { console.log(JSON.stringify({ error: '暂无报告' })); process.exit(1); }
    const indictors = await request('GET', `/indicators/${latestReport.id}`);
    const abnormals = (indictors.body || []).filter(x => x.is_abnormal && x.value != null);
    const checkin = await request('GET', `/checkin/family-status`);
    const cm = (checkin.body?.members || []).find(x => x.name === name);
    console.log(JSON.stringify({
      name: m.name, relation: m.relation,
      latestReportDate: latestReport.report_date,
      abnormalCount: abnormals.length,
      abnormals: abnormals.slice(0, 10).map(a => ({
        name: a.name, value: a.value, unit: a.unit,
        ref: `${a.ref_min || ''}~${a.ref_max || ''}`,
        flag: a.value > a.ref_max ? '↑高' : a.value < a.ref_min ? '↓低' : '异常',
      })),
      checkinStreak: cm?.streak || 0,
      totalCheckins: cm?.recent30Count || 0,
    }, null, 2));
  },
  auth: async (action) => {
    if (action === 'login') {
      const r = await request('POST', '/auth/oauth/cli-session', {});
      const { session_code, alipay_url, wechat_url } = r.body || {};
      if (!alipay_url) { console.log(JSON.stringify({ error: '获取授权链接失败' })); process.exit(1); }
      console.log('\n请选择登录方式：');
      console.log('  [1] 支付宝扫码登录');
      console.log('  [2] 微信扫码登录\n');
      console.log('  支付宝: ' + alipay_url);
      if (wechat_url) console.log('  微信:   ' + wechat_url);
      console.log('\n等待授权...');
      // 轮询等待授权完成
      const poll = () => {
        const req = http.get('https://www.fmlhealth.cn/api/auth/oauth/cli-token?s=' + session_code, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const data = JSON.parse(d);
              if (data.status === 'ok') {
                saveToken(data.token);
                console.log('✅ 授权成功！');
                process.exit(0);
              } else if (data.status === 'expired') {
                console.log(JSON.stringify({ error: '授权已过期，请重新执行 fmlhealth-cli auth login' }));
                process.exit(1);
              }
            } catch (_) {}
            setTimeout(poll, 1500);
          });
        });
        req.on('error', () => setTimeout(poll, 1500));
        req.end();
      };
      poll();
      // 5 分钟超时
      setTimeout(() => { console.log(JSON.stringify({ error: '授权超时' })); process.exit(1); }, 300000);
    }
  },
  '+me': async () => {
    const token = getSavedToken();
    if (!token) { console.log(JSON.stringify({ error: '未登录，请先执行 fmlhealth-cli auth login' })); process.exit(1); }
    const r = await request('GET', '/auth/me');
    if (r.body?.user?.name) {
      console.log(JSON.stringify({ username: r.body.user.name, loggedIn: true }));
    } else if (r.status === 401) {
      console.log(JSON.stringify({ error: 'token 过期，请重新: fmlhealth-cli auth login' }));
    } else {
      console.log(JSON.stringify({ error: '无法获取用户信息', detail: r.body }));
    }
  },
};

(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0] || '+me';
  if (cmd === '+me' || cmd === 'me') return commands['+me']();
  if (!commands[cmd]) {
    console.log(JSON.stringify({ error: `未知命令: ${cmd}`, usage: 'fmlhealth-cli members|health|tests|test-add|test-delete|trend|checkin|analyze|auth|+me' }));
    process.exit(1);
  }
  await commands[cmd](args[1], args[2], args[3], args[4]);
})();
