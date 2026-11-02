# Upload security and PHP web shells

## Changes in the application

All upload handlers use `middleware/secureUpload.js`. Authentication is checked before parsing uploads. The random-names module retains its own authenticated session access, restricted to its URL namespace.

The shared policy checks filenames, exact extension allowlists, matching MIME types, and basic file signatures. Generic `application/octet-stream` is accepted only with an allowed extension and matching signature. Each endpoint also restricts the file types it needs. Finance/business accept PDF; article/prize uploads accept raster images; spreadsheet imports accept their specific formats.

Files are streamed into a private temporary directory outside the web root, with a random directory name and restrictive permissions. The entire stream is checked for PHP opening tags. Only successful checks allow the file to be copied to its destination. Files stored on disk receive UUID names; existing database filenames and download URLs remain usable. Upload errors and aborted requests clean up staging files. Multer removes earlier files when a later file in the same request fails.

`/uploads` uses an extension allowlist and rejects script names, double extensions involving script types, dotfiles, and encoded bypass attempts. Responses use `nosniff` and a sandbox CSP; office/text/archive files are downloaded as attachments. Generated JSON, PDF, raster images and audio retain their normal URLs.

These checks are not an antivirus or a proof that a file is harmless. Basic signatures do not fully validate document structure, and archives/Office files are not unpacked or scanned for macros. PHP content detection is supplementary; uploaded files must never be handled by PHP, CGI, or another server-side interpreter.

## Production configuration still required

The repository changes do not modify the live host or establish whether it was previously compromised. Deploy the application and restart its Node process. Keep the application and upload directories outside a PHP-enabled document root.

If Nginx is in front of Node, route upload requests to Node so they cannot bypass the application guard or fall into a PHP-FPM regex location. Merge the following into the existing server block, adapting the upstream port; do not replace unrelated TLS/application configuration:

```nginx
location ^~ /uploads/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Do not use `alias`/`root` or `fastcgi_pass` to serve this upload directory directly. Check for more-specific exact/prefix locations and nested server configuration that could bypass this route. Validate configuration with `nginx -t` before reloading.

If Apache is in front of Node, proxy `/uploads/` to Node instead of exposing a PHP-enabled filesystem directory through `Alias`/`DocumentRoot`. Disable per-directory overrides and script execution in any legacy upload directory. Review inherited `SetHandler`, PHP-FPM and CGI mappings in the actual virtual host before reloading; this cannot be verified from this repository.

After deployment, verify with an unauthenticated HTTP request that a harmless existing file named with a `.php`, `.phtml` or `.php.jpg` suffix returns a denial/404 and is never interpreted. Use inert test data only. Check access/error logs and inventory existing uploaded files. Retain suspicious files for investigation; these changes do not delete or execute them. If compromise is confirmed, investigate host persistence and rotate affected credentials after containment.

## Verification

```sh
node --test test/uploadSecurity.test.js
npm test
```

The tests use disposable directories under `uploads`, start local HTTP fixture servers, and clean up their files. They do not use the production database. They cover authenticated and anonymous uploads, forged MIME, misleading extensions, content signatures, PHP tags beyond the initial header, size limits, rollback, memory storage, safe stored names, directory escape prevention, and static delivery headers.

References:

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Nginx location matching](https://nginx.org/en/docs/http/ngx_http_core_module.html#location)
- [Apache SetHandler](https://httpd.apache.org/docs/2.4/mod/core.html#sethandler)

## Dependency audit scope

Multer was upgraded from 2.0.2 to 2.5.0, including the fix described in [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). A subsequent `npm audit --omit=dev` did not report Multer. It still reported 37 other affected dependency entries (10 moderate, 25 high, 2 critical), including `basic-ftp` and `proxy-addr` at critical severity. This upload change does not remediate those other dependencies or assess every advisory's exploitability in this application. Re-run the audit during deployment because advisories change.
