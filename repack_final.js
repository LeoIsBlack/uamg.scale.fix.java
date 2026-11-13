// Senior Developer Fix - Complete JAR Repack
var File = java.io.File;
var FileInputStream = java.io.FileInputStream;
var FileOutputStream = java.io.FileOutputStream;
var ZipFile = java.util.zip.ZipFile;
var ZipOutputStream = java.util.zip.ZipOutputStream;
var ZipEntry = java.util.zip.ZipEntry;
var IOUtils = org.apache.commons.io.IOUtils;
var System = java.lang.System;

var jarPath = 'c:\\весы\\lib\\DesktopUmagFX-4.1.0.jar';
var extractedBase = 'c:\\весы\\_extracted';
var tempJar = 'c:\\весы\\lib\\DesktopUmagFX-4.1.0.jar.tmp';

// Files to inject from _extracted directory
var filesToUpdate = {
    // Layouts (clean UTF-8 without BOM)
    'layout/tab.fxml': true,
    'layout/login.fxml': true,
    'layout/sync.fxml': true,
    'layout/products.fxml': true,
    // Styles
    'styles/main.css': true,
    'styles/sync.css': true,
    'styles/products.css': true,
    'styles/add_scale.css': true,
    'styles/login.css': true,
    'styles/dark.css': true,
    // Properties
    'properties/version.properties': true,
    // Patched Bytecode Classes
    'kz/umag/scale/ui/MainControl.class': true,
    'kz/umag/scale/ui/TabControl.class': true,
    'kz/umag/scale/ui/LoginControl.class': true,
    'kz/umag/scale/ui/StagedControl.class': true,
    'kz/umag/scale/ui/AddScaleControl.class': true,
    'kz/umag/scale/resource/scale/use_case/AddScaleUseCase.class': true,
    'kz/umag/scale/lib/libra/ScalesFactory.class': true
};

print('Files to update in JAR:');
for (var key in filesToUpdate) {
    print('  ' + key);
}

var zipFile = new ZipFile(jarPath);
var fos = new FileOutputStream(tempJar);
var zos = new ZipOutputStream(fos);
zos.setLevel(java.util.zip.Deflater.BEST_COMPRESSION);

var seen = {};

// First pass: write updated files
print('\nInjecting updated files...');
for (var entryName in filesToUpdate) {
    var localPath = extractedBase + '/' + entryName.replace(/\//g, java.io.File.separator);
    var f = new File(localPath);
    if (!f.exists()) {
        print('  ERROR (not found): ' + localPath);
        throw new Error('Required file not found: ' + localPath);
    }
    var ze = new ZipEntry(entryName);
    zos.putNextEntry(ze);
    var fis = new FileInputStream(f);
    IOUtils.copy(fis, zos);
    fis.close();
    zos.closeEntry();
    seen[entryName] = true;
    print('  UPDATED: ' + entryName + ' (' + f.length() + ' bytes)');
}

// Second pass: copy everything else from original JAR
print('\nCopying remaining entries from original JAR...');
var entries = zipFile.entries();
var copied = 0;
var skipped = 0;
while (entries.hasMoreElements()) {
    var entry = entries.nextElement();
    var name = entry.getName();
    if (seen[name]) {
        skipped++;
        continue;
    }
    seen[name] = true;
    var newEntry = new ZipEntry(name);
    zos.putNextEntry(newEntry);
    var is = zipFile.getInputStream(entry);
    IOUtils.copy(is, zos);
    is.close();
    zos.closeEntry();
    copied++;
}

zos.close();
fos.close();
zipFile.close();

print('\nCopied ' + copied + ' original entries, skipped ' + skipped + ' updated duplicates');

var originalFile = new File(jarPath);
var tempFile = new File(tempJar);
originalFile.delete();
tempFile.renameTo(originalFile);

print('\n========================================');
print('SUCCESS! JAR updated: ' + jarPath);
print('All dark theme fixes and NPE fixes applied.');
print('========================================');
