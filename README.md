# エッヂ・サブメタ保存庫

エッヂ掲示板 `subject-metadent.txt` のスレ立て ID を5分ごとに収集し、レス番号1の投稿 ID とあわせて保存する GitHub Pages 向けの静的アーカイブです。

## 保存項目

- スレ番号
- metadent 上位4桁
- metadent 下位4桁
- レス番号1の ID

内部的にはスレタイと取得日時も保存し、検索画面に表示します。

## 開発

```bash
npm run update
```

生成物:

- `data/records.json`: 正本データ
- `docs/data/index.json`: GitHub Pages 用検索データ
- `docs/data/records.csv`: CSV 出力

## 自動実行

- `/.github/workflows/update-data.yml`
  - 5分ごとに収集
  - 変更があれば自動コミット
- `/.github/workflows/deploy-pages.yml`
  - `docs/` を GitHub Pages にデプロイ
