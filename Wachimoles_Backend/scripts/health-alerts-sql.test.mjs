import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
async function insert(db, muscle, pain = 7, user = USER) {
  await db.query(`insert into public.body_conditions(user_id,muscle_id,body_region,muscle_name,condition_name,pain_intensity)
    values($1,$2,'Cabeza y cuello',$2,'Pain',$3)`, [user,muscle,pain]);
}
async function episodes(db, rule, openOnly = true) {
  return (await db.query(`select * from public.health_alerts where user_id=$1 and rule=$2 ${openOnly ? 'and resolved_at is null' : ''} order by created_at,id`,[USER,rule])).rows;
}

test('PostgreSQL triggers: boundaries, episodes, ownership, acknowledgements and rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261113_add_body_conditions.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values ($1),($2)',[USER,OTHER]);
    // Test rollout backfill against real pre-existing records.
    await insert(db,'backfill',8);
    await db.exec(await readFile(new URL('../supabase/migrations/20261115_add_health_alerts.sql',import.meta.url),'utf8'));
    assert.equal((await episodes(db,'pain_threshold')).length,1);
    await db.query('delete from public.body_conditions where muscle_id=$1',['backfill']);
    assert.equal((await episodes(db,'pain_threshold')).length,0);
    await insert(db,'neck',7);
    assert.equal((await episodes(db,'pain_threshold')).length,0,'7 does not alert');
    await db.exec(`update body_conditions set pain_intensity=8 where muscle_id='neck'`);
    let pain = (await episodes(db,'pain_threshold'))[0];
    assert.equal(pain.value,8,'8 starts an episode');
    const firstId = pain.id;
    await db.query('update health_alerts set mobile_acknowledged_at=now() where id=$1',[firstId]);
    await db.exec(`update body_conditions set pain_intensity=9 where muscle_id='neck'`);
    pain = (await episodes(db,'pain_threshold'))[0];
    assert.equal(pain.id,firstId,'an ongoing high report does not duplicate');
    assert.equal(pain.value,9);
    assert.ok(pain.mobile_acknowledged_at);
    assert.equal(pain.monitor_acknowledged_at,null,'monitor read state stays independent');
    await db.exec(`update body_conditions set pain_intensity=7 where muscle_id='neck'`);
    assert.equal((await episodes(db,'pain_threshold')).length,0,'decreasing below threshold resolves');
    await db.exec(`update body_conditions set pain_intensity=8 where muscle_id='neck'`);
    pain = (await episodes(db,'pain_threshold'))[0];
    assert.notEqual(pain.id,firstId,'a recurrence is a new episode');
    assert.equal(pain.mobile_acknowledged_at,null);
    await insert(db,'head'); await insert(db,'face');
    assert.equal((await episodes(db,'active_problems')).length,0,'three active problems do not alert');
    await insert(db,'back');
    let count = (await episodes(db,'active_problems'))[0];
    assert.equal(count.value,4,'the fourth active problem alerts');
    const countId = count.id;
    await insert(db,'arm');
    count = (await episodes(db,'active_problems'))[0];
    assert.equal(count.id,countId); assert.equal(count.value,5);
    await insert(db,'other_neck',10,OTHER);
    assert.equal((await episodes(db,'active_problems'))[0].value,5,'other astronauts do not change the count');
    await db.exec(`update body_conditions set status='resolved',resolved_at=now() where muscle_id in ('back','arm')`);
    assert.equal((await episodes(db,'active_problems')).length,0,'resolved reports stop counting');
    await db.exec(`update body_conditions set status='active',resolved_at=null where muscle_id='back'`);
    assert.notEqual((await episodes(db,'active_problems'))[0].id,countId,'count recurrence starts a new episode');
    await db.exec('begin');
    await insert(db,'rollback',10);
    await db.exec('rollback');
    assert.equal((await db.query(`select count(*)::int n from health_alerts where muscle_id='rollback'`)).rows[0].n,0,'reports and alerts roll back together');
    await assert.rejects(db.exec(`set role authenticated; select * from public.health_alerts`),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.exec(`set role authenticated; select public.reconcile_health_alerts('${USER}')`),/permission denied/);
    await db.exec('reset role');
    assert.ok((await episodes(db,'pain_threshold',false)).some(a=>a.resolved_at),'resolved episodes remain in history');
  } finally { await db.close(); }
});
