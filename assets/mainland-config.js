export const mainlandConfig = {
  provider: "cloudbase",
  enabled: false,
  cloudbase: {
    env: "PASTE_CLOUDBASE_ENV_ID",
    region: "ap-shanghai",
    accessKey: "",
    sdkUrl: "https://static.cloudbase.net/cloudbase-js-sdk/2.27.1/cloudbase.full.js",
    collections: {
      messages: "messages",
      leaderboards: "leaderboards"
    }
  }
};
