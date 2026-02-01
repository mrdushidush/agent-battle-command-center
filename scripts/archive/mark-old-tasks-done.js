#!/usr/bin/env node

// IDs of the original 24 pending tasks to mark as completed
const originalTaskIds = [
  'f4481350-8c2a-42bf-a2b5-abb7d3c411c0',
  '4424b0cf-5797-41e6-b986-a954184c33bb',
  'ce636955-070f-49f7-bd7d-fe95fc563ceb',
  '7d563e66-9ffe-4d31-9fa6-3c324e3bb759',
  '86de4101-b2fc-4140-b11a-78914a6493a6',
  '97c496da-2210-4474-8aa7-52e7338ffc44',
  '1f65c078-65c3-4a01-a05d-7ff15b7543af',
  'c8f0deca-734c-49bc-834f-fc09253cf195',
  '084d60ad-d3ad-47aa-98c4-d1a5189c1805',
  '7ad67aaa-22c4-4a97-a54e-39f7cfbfea24',
  'f2dae53b-1d47-4176-8bf4-69efa5e00e63',
  '39547ffa-af2f-4859-8dc2-47f96000807e',
  '852dd6ed-756e-4e8d-898b-3d907ec06639',
  '5a2064d3-c663-4cdf-9bdc-ded4fb70f3a5',
  'd9263aae-7613-41b2-9cb1-58104037c99d',
  '2ff17d9f-cd0b-4fe5-8415-753b485cd191',
  '1285630b-c2f5-4ef3-86f2-982399d4b304',
  '2d68c3ef-1dc7-4fa4-b8dd-26cca2142b06',
  '2a449011-a280-4970-b601-3a082d1bbac0',
  'd8b08498-c1ef-4196-a406-032bc4f792a1',
  'cd9a8645-d4c9-41da-9215-e72b781f84bf',
  '7a252af0-3bda-47d5-b996-4e1b23c4ead8',
  '2355e6c3-35a8-41de-8ce0-067d7f836d46'
];

async function markTasksCompleted() {
  console.log('Marking original pending tasks as completed...\n');
  let completed = 0;
  let failed = 0;

  for (const id of originalTaskIds) {
    try {
      const res = await fetch(`http://localhost:3001/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (res.ok) {
        completed++;
        process.stdout.write('✓');
      } else {
        failed++;
        process.stdout.write('✗');
      }
    } catch (e) {
      failed++;
      process.stdout.write('✗');
    }
  }

  console.log(`\n\n✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
}

markTasksCompleted();
