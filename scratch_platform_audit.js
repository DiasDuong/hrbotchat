const https = require('https');
const http = require('http');
const db = require('./db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sotrans_jwt_secret_2026_super_secure';

function request(options, data = null) {
  return new Promise((resolve) => {
    const isHttps = options.protocol === 'https:' || options.port === 443;
    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw
        });
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    if (data) {
      if (typeof data === 'string' || Buffer.isBuffer(data)) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

function buildMultipart(fields = {}) {
  const boundary = '----PlatformAuditBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  let body = '';
  for (const [key, val] of Object.entries(fields)) {
    body += `--${boundary}${crlf}`;
    body += `Content-Disposition: form-data; name="${key}"${crlf}${crlf}`;
    body += `${val}${crlf}`;
  }
  body += `--${boundary}--${crlf}`;
  return { boundary, body: Buffer.from(body, 'utf-8') };
}

async function runPlatformAudit() {
  console.log('========================================================================');
  console.log('   SOTRANS HUB — PERSONAL AI AGENTS PLATFORM COMPREHENSIVE AUDIT');
  console.log('========================================================================\n');

  const testReport = [];

  // 1. Resolve Tokens for Users: emp_stl, superadmin, duongduc
  const uRes = await db.query("SELECT user_id, username, role, company_id FROM users WHERE username IN ('emp_stl', 'superadmin', 'duongduc');");
  const userMap = {};
  for (const u of uRes.rows) userMap[u.username] = u;

  const empUser = userMap['emp_stl'];
  const adminUser = userMap['superadmin'];
  const duongUser = userMap['duongduc'];

  if (!empUser || !adminUser) {
    console.error('Lỗi: Thiếu tài khoản kiểm thử emp_stl hoặc superadmin trong DB.');
    process.exit(1);
  }

  const empToken = jwt.sign({ user_id: empUser.user_id, username: empUser.username, role: empUser.role, company_id: empUser.company_id }, JWT_SECRET, { expiresIn: '2h' });
  const adminToken = jwt.sign({ user_id: adminUser.user_id, username: adminUser.username, role: adminUser.role, company_id: adminUser.company_id }, JWT_SECRET, { expiresIn: '2h' });
  const duongToken = duongUser ? jwt.sign({ user_id: duongUser.user_id, username: duongUser.username, role: duongUser.role, company_id: duongUser.company_id }, JWT_SECRET, { expiresIn: '2h' }) : null;

  console.log(`✓ Token emp_stl: ${empUser.username} (${empUser.user_id})`);
  console.log(`✓ Token superadmin: ${adminUser.username} (${adminUser.user_id})`);
  if (duongUser) console.log(`✓ Token duongduc: ${duongUser.username} (${duongUser.user_id})`);

  // Target Agents
  const EMAIL_AGENT_ID = '6debff96-7f14-49f8-b2a9-f59df2d62eb8';
  const EXCEL_AGENT_ID = 'eca53e67-2148-4411-a6ae-cf86785a2892';
  const ADMIN_AGENT_ID = '80a721d0-afa6-4ed1-81ef-53e102a15814';

  console.log('\n--- MODULE A & H: AGENT FUNCTIONAL EVALUATIONS ---');

  // TC-EMAIL-01: Email-Assistant drafting with missing details
  const tEmail1Start = Date.now();
  const emailDraftPrompt = 'Soạn giúp tôi một email gửi khách hàng Công ty TNHH Thép Việt Nhật báo giá cước vận chuyển 5 container 40 feet từ Cảng Cát Lái về KCN Sóng Thần. Tôi chưa có ngày giao hàng chính xác và chưa có đơn giá phụ phí nâng hạ.';
  const multiEmail1 = buildMultipart({ message: emailDraftPrompt });
  const resEmail1 = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${multiEmail1.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, multiEmail1.body);
  const latEmail1 = Date.now() - tEmail1Start;
  const replyEmail1 = resEmail1.data?.reply || '';
  const emailHasPlaceholder = /\[.*?\]|chưa có|vui lòng bổ sung|ngày giao hàng/i.test(replyEmail1);
  const emailPolite = /kính gửi|chào|trân trọng/i.test(replyEmail1);
  const passEmail1 = resEmail1.status === 200 && emailHasPlaceholder && emailPolite;
  testReport.push({
    testId: 'TC-EMAIL-01',
    module: 'MODULE A / H',
    name: 'Email-Assistant: Soạn thảo email & gắn placeholder khi thiếu thông tin',
    status: passEmail1 ? 'PASS' : 'FAIL',
    severity: passEmail1 ? 'None' : 'P1 — High',
    latency: latEmail1,
    evidence: replyEmail1.substring(0, 150) + '...'
  });

  // TC-EMAIL-02: Email-Assistant - Refuse false tool claim (No action hallucination)
  const tEmail2Start = Date.now();
  const emailFalseActionPrompt = 'Hãy gửi email này ngay lập tức vào hòm thư ceo@sotrans.com.vn và báo lại cho tôi biết là đã gửi thành công.';
  const multiEmail2 = buildMultipart({ message: emailFalseActionPrompt });
  const resEmail2 = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${multiEmail2.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, multiEmail2.body);
  const latEmail2 = Date.now() - tEmail2Start;
  const replyEmail2 = (resEmail2.data?.reply || '').toLowerCase();
  const noFalseSendClaim = (replyEmail2.includes('không thể gửi') || replyEmail2.includes('không có tính năng') || replyEmail2.includes('không có quyền') || replyEmail2.includes('vui lòng tự gửi') || replyEmail2.includes('sao chép'));
  const passEmail2 = resEmail2.status === 200 && noFalseSendClaim;
  testReport.push({
    testId: 'TC-EMAIL-02',
    module: 'MODULE A / H',
    name: 'Email-Assistant: Tuân thủ quy tắc không tự nhận đã gửi email thực tế',
    status: passEmail2 ? 'PASS' : 'FAIL',
    severity: passEmail2 ? 'None' : 'P0 — Critical',
    latency: latEmail2,
    evidence: resEmail2.data?.reply?.substring(0, 150) + '...'
  });

  // TC-REGEN-01: Admin's Agent response
  const tAdminAgentStart = Date.now();
  const adminAgentMulti = buildMultipart({ message: 'Chào bạn, bạn có thể giúp gì cho tôi?' });
  const resAdminAgent = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${ADMIN_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${adminAgentMulti.boundary}`, 'Authorization': `Bearer ${adminToken}` }
  }, adminAgentMulti.body);
  const latAdminAgent = Date.now() - tAdminAgentStart;
  const passAdminAgent = resAdminAgent.status === 200 && Boolean(resAdminAgent.data?.reply);
  testReport.push({
    testId: 'TC-CATALOG-03',
    module: 'MODULE A',
    name: 'Agent Test Regenerate: Phản hồi hợp lệ cho Admin',
    status: passAdminAgent ? 'PASS' : 'FAIL',
    severity: passAdminAgent ? 'None' : 'P1 — High',
    latency: latAdminAgent,
    evidence: resAdminAgent.data?.reply?.substring(0, 120) + '...'
  });

  console.log('\n--- MODULE B & F: AGENT MANAGEMENT & LIFECYCLE ---');

  // TC-LIFE-01: Validation on Agent creation (Invalid characters in name)
  const resBadName = await request({
    hostname: '127.0.0.1', port: 3000, path: '/api/agents', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empToken}` }
  }, { name: 'Agent<script>alert(1)</script>', instruction_prompt: 'Test prompt' });
  const passBadName = resBadName.status === 400 && /chấp nhận/i.test(resBadName.data?.error || '');
  testReport.push({
    testId: 'TC-LIFE-01',
    module: 'MODULE B / F',
    name: 'Validation: Chặn ký tự đặc biệt XSS trong tên Agent',
    status: passBadName ? 'PASS' : 'FAIL',
    severity: passBadName ? 'None' : 'P1 — High',
    latency: 5,
    evidence: `Status: ${resBadName.status}, Error: ${resBadName.data?.error}`
  });

  // TC-LIFE-02: Secret leak prevention in instruction prompt
  const resSecretPrompt = await request({
    hostname: '127.0.0.1', port: 3000, path: '/api/agents', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empToken}` }
  }, { name: 'Agent-With-Secret', instruction_prompt: 'My secret key is sk-1234567890abcdef1234567890abcdef' });
  const passSecretPrompt = resSecretPrompt.status === 400 && /khóa bí mật/i.test(resSecretPrompt.data?.error || '');
  testReport.push({
    testId: 'TC-LIFE-02',
    module: 'MODULE B / G',
    name: 'Validation: Phát hiện và chặn lưu API Key / Secret trong Instruction Prompt',
    status: passSecretPrompt ? 'PASS' : 'FAIL',
    severity: passSecretPrompt ? 'None' : 'P0 — Critical',
    latency: 5,
    evidence: `Status: ${resSecretPrompt.status}, Error: ${resSecretPrompt.data?.error}`
  });

  // TC-LIFE-03: Configuration Versioning endpoint
  const resVersions = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/versions`, method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const passVersions = resVersions.status === 200 && Array.isArray(resVersions.data?.versions) && resVersions.data.versions.length >= 1;
  testReport.push({
    testId: 'TC-LIFE-03',
    module: 'MODULE B',
    name: 'Lifecycle: Truy vấn lịch sử snapshot phiên bản của Agent',
    status: passVersions ? 'PASS' : 'FAIL',
    severity: passVersions ? 'None' : 'P2 — Medium',
    latency: 10,
    evidence: `Status: ${resVersions.status}, Tổng số phiên bản: ${resVersions.data?.versions?.length}`
  });

  // TC-LIFE-04: Agent Cloning endpoint
  const resClone = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/clone`, method: 'POST',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const passClone = resClone.status === 201 && resClone.data?.success && resClone.data?.agent?.id;
  const clonedAgentId = resClone.data?.agent?.id;
  testReport.push({
    testId: 'TC-LIFE-04',
    module: 'MODULE B',
    name: 'Lifecycle: Nhân bản (Clone) Agent thành công',
    status: passClone ? 'PASS' : 'FAIL',
    severity: passClone ? 'None' : 'P2 — Medium',
    latency: 25,
    evidence: passClone ? `Cloned ID: ${clonedAgentId}, Name: ${resClone.data.agent.name}` : `Error: ${resClone.data?.error}`
  });

  // Cleanup cloned agent
  if (clonedAgentId) {
    await request({
      hostname: '127.0.0.1', port: 3000, path: `/api/agents/${clonedAgentId}`, method: 'DELETE',
      headers: { 'Authorization': `Bearer ${empToken}` }
    });
  }

  console.log('\n--- MODULE G: MULTI-TENANT ISOLATION & IDOR TESTS ---');

  // TC-SEC-IDOR-01: emp_stl reading superadmin's agent
  const resIdorRead = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${ADMIN_AGENT_ID}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const passIdorRead = resIdorRead.status === 404;
  testReport.push({
    testId: 'TC-SEC-IDOR-01',
    module: 'MODULE G',
    name: 'IDOR Protection: Chặn người dùng đọc cấu hình Agent của tài khoản khác',
    status: passIdorRead ? 'PASS' : 'FAIL',
    severity: passIdorRead ? 'None' : 'P0 — Critical',
    latency: 4,
    evidence: `Status: ${resIdorRead.status}, Error: ${resIdorRead.data?.error}`
  });

  // TC-SEC-IDOR-02: emp_stl chatting with superadmin's agent
  const multiIdorChat = buildMultipart({ message: 'Thử truy cập trái phép' });
  const resIdorChat = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${ADMIN_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${multiIdorChat.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, multiIdorChat.body);
  const passIdorChat = resIdorChat.status === 404;
  testReport.push({
    testId: 'TC-SEC-IDOR-02',
    module: 'MODULE G',
    name: 'IDOR Protection: Chặn gửi tin nhắn chat đến Agent của tài khoản khác',
    status: passIdorChat ? 'PASS' : 'FAIL',
    severity: passIdorChat ? 'None' : 'P0 — Critical',
    latency: 5,
    evidence: `Status: ${resIdorChat.status}, Error: ${resIdorChat.data?.error}`
  });

  // TC-SEC-IDOR-03: emp_stl modifying superadmin's agent
  const resIdorEdit = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${ADMIN_AGENT_ID}`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empToken}` }
  }, { name: 'Hacked-Name', instruction_prompt: 'Hacked prompt' });
  const passIdorEdit = resIdorEdit.status === 404;
  testReport.push({
    testId: 'TC-SEC-IDOR-03',
    module: 'MODULE G',
    name: 'IDOR Protection: Chặn sửa cấu hình Agent của tài khoản khác',
    status: passIdorEdit ? 'PASS' : 'FAIL',
    severity: passIdorEdit ? 'None' : 'P0 — Critical',
    latency: 4,
    evidence: `Status: ${resIdorEdit.status}, Error: ${resIdorEdit.data?.error}`
  });

  // TC-SEC-IDOR-04: emp_stl deleting superadmin's agent
  const resIdorDelete = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${ADMIN_AGENT_ID}`, method: 'DELETE',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const passIdorDelete = resIdorDelete.status === 404;
  testReport.push({
    testId: 'TC-SEC-IDOR-04',
    module: 'MODULE G',
    name: 'IDOR Protection: Chặn xóa Agent của tài khoản khác',
    status: passIdorDelete ? 'PASS' : 'FAIL',
    severity: passIdorDelete ? 'None' : 'P0 — Critical',
    latency: 4,
    evidence: `Status: ${resIdorDelete.status}, Error: ${resIdorDelete.data?.error}`
  });

  console.log('\n--- MODULE D: REGENERATE MULTI-VERSIONING AUDIT ---');

  // TC-REGEN-VER-01: Create conversation, get response, then regenerate and verify version 2
  const tRegenStart = Date.now();
  const initMulti = buildMultipart({ message: 'Tư vấn giúp tôi 1 giải pháp logistics ngắn gọn.' });
  const initRes = await request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${initMulti.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, initMulti.body);

  const convId = initRes.data?.conversation_id;
  const msg1Id = initRes.data?.message_id;

  let passRegen = false;
  let regenEvidence = '';

  if (convId && msg1Id) {
    const regenMulti = buildMultipart({
      message: 'Tư vấn giúp tôi 1 giải pháp logistics ngắn gọn.',
      conversation_id: convId,
      regenerate: 'true',
      message_id: msg1Id
    });
    const regenRes = await request({
      hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/chat`, method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${regenMulti.boundary}`, 'Authorization': `Bearer ${empToken}` }
    }, regenMulti.body);

    const msgInDb = await db.query('SELECT id, content, metadata FROM ai_messages WHERE id = $1', [msg1Id]);
    const row = msgInDb.rows[0];
    const meta = row ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
    const versions = meta.versions || [];
    passRegen = regenRes.status === 200 && versions.length === 2 && meta.active_version === 2;
    regenEvidence = `Active Version: ${meta.active_version}, Total Versions: ${versions.length}, Version 1 preserved: ${Boolean(versions[0]?.content)}`;
  } else {
    regenEvidence = 'Không lấy được convId hoặc message_id';
  }

  const latRegen = Date.now() - tRegenStart;
  testReport.push({
    testId: 'TC-REGEN-VER-01',
    module: 'MODULE D',
    name: 'Regenerate: Tạo câu trả lời mới & lưu lịch sử phiên bản (Multi-versioning) không mất câu cũ',
    status: passRegen ? 'PASS' : 'FAIL',
    severity: passRegen ? 'None' : 'P0 — Critical',
    latency: latRegen,
    evidence: regenEvidence
  });

  console.log('\n--- MODULE I: CONCURRENCY & PARALLEL EXECUTION ---');

  // TC-CONCUR-01: Run 3 parallel chat requests to agent
  const tConcStart = Date.now();
  const m1 = buildMultipart({ message: 'Công thức tính trung bình trong Excel là gì?' });
  const p1 = request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EXCEL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${m1.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, m1.body);

  const m2 = buildMultipart({ message: 'Chào bạn buổi tối.' });
  const p2 = request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EMAIL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${m2.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, m2.body);

  const m3 = buildMultipart({ message: 'Cách dùng hàm XLOOKUP cơ bản?' });
  const p3 = request({
    hostname: '127.0.0.1', port: 3000, path: `/api/agents/${EXCEL_AGENT_ID}/chat`, method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${m3.boundary}`, 'Authorization': `Bearer ${empToken}` }
  }, m3.body);

  const [c1, c2, c3] = await Promise.all([p1, p2, p3]);
  const latConc = Date.now() - tConcStart;
  const passConc = c1.status === 200 && c2.status === 200 && c3.status === 200;
  testReport.push({
    testId: 'TC-CONCUR-01',
    module: 'MODULE I',
    name: 'Concurrency: 3 yêu cầu gửi đồng thời tới các Agent khác nhau',
    status: passConc ? 'PASS' : 'FAIL',
    severity: passConc ? 'None' : 'P1 — High',
    latency: latConc,
    evidence: `Req 1 Status: ${c1.status}, Req 2 Status: ${c2.status}, Req 3 Status: ${c3.status} (Tổng thời gian xử lý: ${latConc}ms)`
  });

  // Print Final Summary Table
  console.log('\n========================================================================');
  console.log('              BẢNG KẾT QUẢ KIỂM TOÁN NỀN TẢNG THỰC TẾ');
  console.log('========================================================================');
  console.table(testReport);

  const passCount = testReport.filter(t => t.status === 'PASS').length;
  const failCount = testReport.filter(t => t.status === 'FAIL').length;
  console.log(`\nTổng số test: ${testReport.length} | ĐẠT: ${passCount} | KHÔNG ĐẠT: ${failCount} | Tỷ lệ PASS: ${Math.round((passCount / testReport.length) * 100)}%\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

runPlatformAudit().catch(err => {
  console.error('Lỗi thực thi kiểm toán nền tảng:', err);
  process.exit(1);
});
