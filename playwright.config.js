const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',timeout:25000,workers:1,
  reporter:[['list'],['json',{outputFile:'test-results/results.json'}]],
  use:{baseURL:process.env.ARIA_BASE_URL||'http://127.0.0.1:8765',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer: process.env.ARIA_BASE_URL ? undefined : {command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765',reuseExistingServer:true}
});
