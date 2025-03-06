const express = require('express');
const request = require('request');
const { JSDOM } = require('jsdom');
const path = require('path');
const exphbs = require('express-handlebars');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Function to apply ROT13 transformation
function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (char) {
        return String.fromCharCode(
            char.charCodeAt(0) + (char.toLowerCase() < 'n' ? 13 : -13)
        );
    });
}

// Set up Handlebars as the view engine
app.engine('.hbs', exphbs.engine({ 
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'src', 'pages', 'layouts'),
    defaultLayout: 'main'
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'src', 'pages'));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Route to render index.hbs
app.get('/', (req, res) => {
    res.render('index', { title: "Callm3batman's WebProxy" });
});

// Proxy endpoint
app.get('/proxy', (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL parameter is required');
    }

    // Fetch the main page
    request(url, (error, response, body) => {
        if (error) {
            return res.status(500).send('Error fetching the URL');
        }

        // Parse the HTML and rewrite links
        const dom = new JSDOM(body);
        const document = dom.window.document;
        const baseUrl = new URL(url);

        // Inject Eruda script
        const erudaScript = document.createElement('script');
        erudaScript.src = '//cdn.jsdelivr.net/npm/eruda';
        document.body.appendChild(erudaScript);

        // Inject Eruda initialization script after the Eruda script is loaded
        const erudaInitScript = document.createElement('script');
        erudaInitScript.textContent = `
            document.addEventListener('DOMContentLoaded', function() {
                eruda.init();
            });
        `;
        document.body.appendChild(erudaInitScript);

        // Rewrite all anchor tags
        document.querySelectorAll('a').forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href && !href.startsWith('#')) {
                const absoluteUrl = new URL(href, baseUrl).href;
                anchor.setAttribute('href', `/proxy?url=${absoluteUrl}`);
            }
        });

        // Rewrite all src attributes (for scripts and images)
        document.querySelectorAll('[src]').forEach(element => {
            const src = element.getAttribute('src');
            if (src) {
                const absoluteUrl = new URL(src, baseUrl).href;
                element.setAttribute('src', `/proxy/asset?url=${absoluteUrl}`);
            }
        });

        res.send(dom.serialize());
    });
});

// Proxy endpoint for assets
app.get('/proxy/asset', (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL parameter is required');
    }

    request(url).pipe(res);
});

app.listen(port, () => {
    console.log(`Proxy server is running on port ${port}`);
});
