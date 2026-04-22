const db = require('./models');

db.sequelize.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .then(([rows]) => {
    console.log('Tables in database:');
    rows.forEach(r => console.log(' -', r.name));
    process.exit();
  })
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  });
