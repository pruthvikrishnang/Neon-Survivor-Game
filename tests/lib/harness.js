const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function run() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      fn();
      passed += 1;
      console.log(`ok ${passed + failed} - ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok ${passed + failed} - ${name}`);
      console.error(error);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
