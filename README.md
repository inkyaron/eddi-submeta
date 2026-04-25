# エッヂ・サブメタ保存庫

エッヂ掲示板 `subject-metadent.txt` のスレ立て ID を5分ごとに収集し、レス番号1の投稿 ID とあわせて保存する GitHub Pages 向けの静的アーカイブです。

## 保存項目

- スレ番号
- metadent 上位4桁
- metadent 下位4桁
- レス番号1の ID
- レス番号1の日時

## 開発

```bash
python scripts/fetch.py
```

生成物:

- `data/records.json`: 正本データ兼 GitHub Pages 用検索データ

## 自動実行

- `/.github/workflows/update-data.yml`
  - GitHub Actions の `schedule` を維持
  - さらに `workflow_dispatch` の self-dispatch 連鎖で GitHub 内だけで5分更新を自己維持
  - 直近4分以内に更新済みなら重複実行をスキップ
  - 変更があれば自動コミット
- `/.github/workflows/deploy-pages.yml`
  - `docs/` を GitHub Pages にデプロイ
