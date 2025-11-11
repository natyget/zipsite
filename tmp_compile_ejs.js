const ejs = require('ejs');

const path = 'views/public/home.ejs';

ejs.renderFile(path, {}, {}, (err, str) => {
    if (err) {
        console.error('ERROR:', err && err.message);
        console.error(err && err.stack);
        process.exit(1);
    }
    console.log('Rendered OK');
});
