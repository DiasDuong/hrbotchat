const db = require('./db');

async function main() {
  try {
    const users = await db.query("SELECT user_id, username, role, company_id, status FROM users ORDER BY user_id;");
    console.log('=== USERS IN SYSTEM (' + users.rows.length + ') ===');
    console.log(JSON.stringify(users.rows, null, 2));

    const agents = await db.query(`
      SELECT ua.id, ua.user_id, u.username, ua.name, ua.agent_type, ua.model_name, 
             ua.temperature, ua.max_steps, ua.enabled_tools, ua.status, ua.current_version, 
             ua.created_at, ua.updated_at, LENGTH(ua.instruction_prompt) as prompt_len,
             SUBSTRING(ua.instruction_prompt, 1, 80) as prompt_preview
      FROM user_agents ua
      LEFT JOIN users u ON ua.user_id = u.user_id
      ORDER BY ua.created_at ASC;
    `);
    console.log('\n=== ALL USER_AGENTS (' + agents.rows.length + ') ===');
    console.log(JSON.stringify(agents.rows, null, 2));

    const versions = await db.query(`
      SELECT agent_id, version_number, name, change_summary, created_at 
      FROM user_agent_versions 
      ORDER BY created_at DESC;
    `);
    console.log('\n=== USER_AGENT_VERSIONS (' + versions.rows.length + ') ===');
    console.log(JSON.stringify(versions.rows, null, 2));

    const outputs = await db.query(`
      SELECT id, user_id, agent_id, conversation_id, file_name, 
             file_size, mime_type, checksum_sha256, download_count, expires_at, created_at 
      FROM agent_output_files 
      ORDER BY created_at DESC LIMIT 10;
    `);
    console.log('\n=== AGENT_OUTPUT_FILES (' + outputs.rows.length + ') ===');
    console.log(JSON.stringify(outputs.rows, null, 2));

    const convs = await db.query(`
      SELECT c.id, c.user_id, c.agent_id, c.title, c.status, c.created_at, c.updated_at,
             (SELECT COUNT(*)::int FROM ai_messages m WHERE m.conversation_id = c.id) as msg_count
      FROM ai_conversations c
      WHERE c.agent_id IS NOT NULL AND c.agent_id != ''
      ORDER BY c.updated_at DESC LIMIT 15;
    `);
    console.log('\n=== AI_CONVERSATIONS WITH AGENTS (' + convs.rows.length + ') ===');
    console.log(JSON.stringify(convs.rows, null, 2));

    const fkQuery = await db.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.table_name IN ('user_agents', 'user_agent_versions', 'agent_output_files', 'ai_conversations', 'ai_messages')
      ORDER BY tc.table_name;
    `);
    console.log('\n=== FOREIGN KEYS & DELETE RULES ===');
    console.log(JSON.stringify(fkQuery.rows, null, 2));

  } catch (err) {
    console.error('Error during DB audit query:', err);
  } finally {
    process.exit(0);
  }
}

main();
