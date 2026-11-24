// =============================================================================
// repack_final.js — пересборка lib/DesktopUmagFX-4.1.0.jar из _extracted/.
//
// Запуск из корня репозитория (приложение должно быть закрыто):
//     jre\bin\jjs.exe -cp "lib\*" repack_final.js
//
// В JAR попадает КАЖДЫЙ файл из _extracted/ (заменяя одноимённый в JAR или
// добавляясь как новый), остальное копируется из текущего JAR без изменений.
// Ручного списка файлов больше нет — новый или изменённый файл в _extracted/
// не потеряется.
// =============================================================================

var File = Java.type('java.io.File');
var FileInputStream = Java.type('java.io.FileInputStream');
var FileOutputStream = Java.type('java.io.FileOutputStream');
var ZipFile = Java.type('java.util.zip.ZipFile');
var ZipOutputStream = Java.type('java.util.zip.ZipOutputStream');
var ZipEntry = Java.type('java.util.zip.ZipEntry');
var Deflater = Java.type('java.util.zip.Deflater');
var Files = Java.type('java.nio.file.Files');
var StandardCopyOption = Java.type('java.nio.file.StandardCopyOption');
var ByteArray = Java.type('byte[]');

var ROOT = new File(__DIR__).getAbsolutePath();
var jarFile = new File(ROOT, 'lib/DesktopUmagFX-4.1.0.jar');
var tmpFile = new File(ROOT, 'lib/DesktopUmagFX-4.1.0.jar.tmp');
var extracted = new File(ROOT, '_extracted');

if (!jarFile.exists()) throw new Error('JAR не найден: ' + jarFile);
if (!extracted.isDirectory()) throw new Error('Нет каталога: ' + extracted);

function copy(input, output) {
    var buf = new ByteArray(65536);
    var n;
    while ((n = input.read(buf)) > 0) output.write(buf, 0, n);
}

// Все файлы _extracted/ с путями вида "styles/dark.css"
var local = [];
(function walk(dir, prefix) {
    var list = dir.listFiles();
    for (var i = 0; i < list.length; i++) {
        var f = list[i];
        var name = prefix + f.getName();
        if (f.isDirectory()) walk(f, name + '/');
        else local.push({ name: name, file: f });
    }
})(extracted, '');
// MANIFEST.MF должен идти первым
local.sort(function (a, b) {
    if (a.name == 'META-INF/MANIFEST.MF') return -1;
    if (b.name == 'META-INF/MANIFEST.MF') return 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
});

var zip = new ZipFile(jarFile);
var zos = new ZipOutputStream(new FileOutputStream(tmpFile));
zos.setLevel(Deflater.BEST_COMPRESSION);
var seen = {};
var replaced = 0, added = 0, copied = 0;

try {
    for (var i = 0; i < local.length; i++) {
        var e = local[i];
        if (zip.getEntry(e.name) != null) replaced++; else { added++; print('  NEW: ' + e.name); }
        zos.putNextEntry(new ZipEntry(e.name));
        var fis = new FileInputStream(e.file);
        try { copy(fis, zos); } finally { fis.close(); }
        zos.closeEntry();
        seen[e.name] = true;
    }

    var entries = zip.entries();
    while (entries.hasMoreElements()) {
        var entry = entries.nextElement();
        var name = entry.getName();
        if (seen[name]) continue;
        seen[name] = true;
        zos.putNextEntry(new ZipEntry(name));
        var is = zip.getInputStream(entry);
        try { copy(is, zos); } finally { is.close(); }
        zos.closeEntry();
        copied++;
    }
} finally {
    zos.close();
    zip.close();
}

Files.move(tmpFile.toPath(), jarFile.toPath(), StandardCopyOption.REPLACE_EXISTING);

print('Из _extracted: заменено ' + replaced + ', добавлено ' + added + '; без изменений скопировано ' + copied);
print('Готово: ' + jarFile);
