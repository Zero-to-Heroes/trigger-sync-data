# Test it

```
npm run build && sam local invoke -t template.yaml -e event.json SyncStatsFunction
```

# Deploy

```
rm -rf dist/ && npm run build && npm run package && npm run deploy
```

# Reference

Used this project as template: https://github.com/alukach/aws-sam-typescript-boilerplate
