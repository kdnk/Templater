# AGENTS.md instructions

- git の操作は but (GitButler) を使ってください。この repository は `but setup` 済みです。
- git の読み取り専用操作は必要に応じて使っても構いませんが、commit、push、branch、merge、stash、checkout、rebase などの書き込み操作は but を使ってください。
- github の url に直接アクセス禁止。 gh cli を使ってください。
- この workspace の操作対象 repository は `kdnk/Templater` です。
- fork 元 repository は `SilentVoid13/Templater` です。fork 元には何もしないでください。
- push、PR 作成、PR merge、release、workflow 操作などは `kdnk/Templater` に限定してください。
- release について
    - GitHub Release は手動作成しないでください。通常手順で `gh release create` を実行してはいけません。
    - release は release PR を merge した後、該当 version tag を `kdnk/Templater` に push し、`.github/workflows/release.yml` の `Plugin release` workflow に作成させてください。
    - tag の作成と push は GitButler の通常フローに無いため、release tag に限って `git tag <version>` と `git push origin <version>` を使ってよいです。必要ならその時だけ Git workflow に戻してください。
    - release PR では `package.json`、`manifest.json`、`versions.json`、`CHANGELOG.md` の version/changelog 更新だけを行ってください。hotfix/feature の実装変更は先に別 PR で merge 済みにしてください。
    - tag 作成後は `gh run list` / `gh run watch` で `Plugin release` workflow の完了を確認し、最後に `gh release view <version> --repo kdnk/Templater` で release と assets を確認してください。
    - 同名 release/tag が既に存在する場合でも、手動で release を作り直さないでください。workflow の結果と `.github/workflows/release.yml` を確認し、必要なら workflow 側を修正してから rerun してください。
- commit について
    - commit するときは、conventional commit に従ってください。英語で commit メッセージを書いてください。
    - commit description も丁寧に書いてください。Why と What がわかるように書いてください。
