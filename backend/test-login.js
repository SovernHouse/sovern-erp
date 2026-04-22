require("dotenv").config();
const db = require("./models");

async function test() {
  await db.sequelize.authenticate();
  const accounts = [
    { email: "admin@floortrading.com", password: "admin123", label: "Admin" },
    { email: "alice@premiumflooring.com", password: "password123", label: "Customer" },
    { email: "contact@ceramictile.cn", password: "factory123", label: "Factory" },
  ];
  for (const acct of accounts) {
    const user = await db.User.findOne({ where: { email: acct.email } });
    if (user === null) {
      console.log("NOTFOUND " + acct.label + ": " + acct.email);
      continue;
    }
    const valid = await user.comparePassword(acct.password);
    const status = valid ? "OK" : "FAIL";
    console.log(status + " " + acct.label + ": " + acct.email + " role=" + user.role + " active=" + user.isActive);
  }
  console.log("\nTotal users:", await db.User.count());
  await db.sequelize.close();
}
test().catch(e => { console.error(e); process.exit(1); });
