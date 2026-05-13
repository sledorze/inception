# Branch Protection Setup for `main`

Step-by-step instructions for configuring branch protection rules on the `main` branch via the GitHub UI.

## Navigation

1. Go to the repository on GitHub
2. Click **Settings** (top navigation bar)
3. Click **Branches** (left sidebar, under "Code and automation")
4. Click **Add branch protection rule** (or edit the existing rule for `main`)

## Configuration

### Branch name pattern

```
main
```

### Protect matching branches

#### Require a pull request before merging

- [x] **Require a pull request before merging**
  - [x] **Require approvals** — set to **1**
  - [x] **Dismiss stale pull request approvals when new commits are pushed**

#### Require status checks to pass before merging

- [x] **Require status checks to pass before merging**
  - [x] **Require branches to be up to date before merging**
  - Add the following **required status checks** (search by exact job name):
    - `lint`
    - `format`
    - `typecheck`
    - `test`
    - `mutation`
    - `syncpack`

#### Do not allow bypassing the above settings

- [x] **Do not allow bypassing the above settings**

This ensures administrators and repository owners cannot bypass the protection rules.

## Save

Click **Create** (or **Save changes** if editing an existing rule) to apply the branch protection rule.
