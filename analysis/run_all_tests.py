#!/usr/bin/env python3
"""
Run all test suites and capture output with commands for evidence table.
"""
import subprocess, os, json, time

os.chdir(r'c:\Users\ghaob\BaiTapLon va BaiTapCaNhan\ATTT kbt hạnpgp_in_business_environment')

results = []

# Engineer 2 tests (main project)
ks2_tests = [
    'tests/engineer2-api-smoke.mjs',
    'tests/engineer2-api-auth.test.mjs',
    'tests/engineer2-quorum-ca.test.mjs',
    'tests/engineer2-quorum-shards.test.mjs',
    'tests/engineer2-demo-key-gate.test.mjs',
    'tests/engineer2-ttl-expiry.test.mjs',
]

for test_file in ks2_tests:
    cmd = f'node {test_file}'
    print(f'\n=== Running: {cmd} ===')
    start = time.time()
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, 
                          encoding='utf-8', errors='replace')
    elapsed = time.time() - start
    
    results.append({
        'engineer': 'KS2',
        'test_file': test_file,
        'command': cmd,
        'exit_code': result.returncode,
        'elapsed_sec': round(elapsed, 2),
        'stdout': result.stdout,
        'stderr': result.stderr,
    })
    
    print(f'Exit code: {result.returncode}, Elapsed: {elapsed:.2f}s')
    print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)

# KS3 Merkle test
ks3_dir = r'analysis\zips-extracted\Ma_nguon_Ky_su_3_Nguyen_The_Duong (1)\Ky_su_3_Merkle'
ks3_cmd = f'cd "{ks3_dir}" && node test/merkle-engine.test.js'
print(f'\n=== Running: {ks3_cmd} ===')
start = time.time()
result = subprocess.run(ks3_cmd, shell=True, capture_output=True, text=True,
                      encoding='utf-8', errors='replace')
elapsed = time.time() - start

results.append({
    'engineer': 'KS3',
    'test_file': 'test/merkle-engine.test.js',
    'command': ks3_cmd,
    'exit_code': result.returncode,
    'elapsed_sec': round(elapsed, 2),
    'stdout': result.stdout,
    'stderr': result.stderr,
})
print(f'Exit code: {result.returncode}, Elapsed: {elapsed:.2f}s')
print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)

# KS4 WoT test
ks4_dir = r'analysis\zips-extracted\PGP_KySu4_WoT_Source\PGP_KySu4_WoT_Source'
ks4_cmd = f'cd "{ks4_dir}" && node wot-analyzer.test.js'
print(f'\n=== Running: {ks4_cmd} ===')
start = time.time()
result = subprocess.run(ks4_cmd, shell=True, capture_output=True, text=True,
                      encoding='utf-8', errors='replace')
elapsed = time.time() - start

results.append({
    'engineer': 'KS4',
    'test_file': 'wot-analyzer.test.js',
    'command': ks4_cmd,
    'exit_code': result.returncode,
    'elapsed_sec': round(elapsed, 2),
    'stdout': result.stdout,
    'stderr': result.stderr,
})
print(f'Exit code: {result.returncode}, Elapsed: {elapsed:.2f}s')
print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)

# KS5 Packet Inspector - check if tests exist
ks5_dir = r'analysis\zips-extracted\OpenPGP_Packet_Inspector_Demo\pgp_demo'
ks5_test_candidates = ['test.js', 'run-demo.js']
for candidate in ks5_test_candidates:
    ks5_file = os.path.join(ks5_dir, candidate)
    if os.path.exists(ks5_file):
        ks5_cmd = f'cd "{ks5_dir}" && node {candidate}'
        print(f'\n=== Running: {ks5_cmd} ===')
        start = time.time()
        result = subprocess.run(ks5_cmd, shell=True, capture_output=True, text=True,
                              encoding='utf-8', errors='replace', timeout=120)
        elapsed = time.time() - start
        
        results.append({
            'engineer': 'KS5',
            'test_file': candidate,
            'command': ks5_cmd,
            'exit_code': result.returncode,
            'elapsed_sec': round(elapsed, 2),
            'stdout': result.stdout,
            'stderr': result.stderr,
        })
        print(f'Exit code: {result.returncode}, Elapsed: {elapsed:.2f}s')
        print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)
        break

# Write JSON results
with open(r'analysis\_evidence\test_runs.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

# Write summary
with open(r'analysis\_evidence\test_summary.txt', 'w', encoding='utf-8') as f:
    f.write('TEST EXECUTION SUMMARY\n')
    f.write('=' * 80 + '\n\n')
    for r in results:
        f.write(f"Engineer: {r['engineer']}\n")
        f.write(f"Test: {r['test_file']}\n")
        f.write(f"Command: {r['command']}\n")
        f.write(f"Exit code: {r['exit_code']} ({'PASS' if r['exit_code'] == 0 else 'FAIL'})\n")
        f.write(f"Elapsed: {r['elapsed_sec']}s\n")
        f.write('-' * 80 + '\n\n')

print('\n\n=== ALL TESTS COMPLETE ===')
print(f'Results saved to analysis\\_evidence\\test_runs.json')
print(f'Summary saved to analysis\\_evidence\\test_summary.txt')
