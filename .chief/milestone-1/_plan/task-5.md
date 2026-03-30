# Task 5: Add CI Workflows and Run Full Acceptance Checks

## Objective
Create GitHub Actions CI workflows for test-and-build and release. Run the full acceptance checklist to confirm milestone completion.

## Scope
- `.github/workflows/test-and-build.yml`
- `.github/workflows/release.yml`
- Final acceptance verification of all criteria

### Excluded
- Fixing issues in other packages (those should be addressed in earlier tasks)

## Rules and Contracts to Follow
- `.chief/_rules/_verification/acceptance-checks.md`
- `.chief/milestone-1/_goal/goal.md` (acceptance criteria)
- `.chief/milestone-1/_contract/contract.md`

## Steps
1. Create `.github/workflows/test-and-build.yml`:
   - Trigger on push to main and pull requests
   - Setup pnpm + Node.js
   - Run: `pnpm install`, `pnpm build`, `pnpm check-types`, `pnpm lint:check`, `pnpm test`
2. Create `.github/workflows/release.yml`:
   - Trigger on push to main (or manual dispatch)
   - Use changesets/action for automated release PR or publish
   - Setup pnpm + Node.js
3. Validate both YAML files are syntactically correct
4. Run the full acceptance checklist locally:
   - Clean install: `rm -rf node_modules && pnpm install`
   - `pnpm build`
   - `pnpm check-types`
   - `pnpm lint:check`
   - `pnpm test`
5. Write completion report to `.chief/milestone-1/_report/acceptance-report.md`

## Acceptance Criteria
- `.github/workflows/test-and-build.yml` exists and is valid YAML
- `.github/workflows/release.yml` exists and is valid YAML
- All 8 acceptance criteria from the milestone goal pass
- Completion report documents each criterion's pass/fail status

## Verification
```bash
# CI files exist
test -f .github/workflows/test-and-build.yml
test -f .github/workflows/release.yml
# YAML is valid
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.github/workflows/test-and-build.yml','utf8')); console.log('valid')"
# Full acceptance
pnpm install
pnpm build
pnpm check-types
pnpm lint:check
pnpm test
```

## Deliverables
- `.github/workflows/test-and-build.yml`
- `.github/workflows/release.yml`
- `.chief/milestone-1/_report/acceptance-report.md`
