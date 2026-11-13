var ClassPool = Java.type('javassist.ClassPool');
var CtField = Java.type('javassist.CtField');
var Modifier = Java.type('javassist.Modifier');
var File = Java.type('java.io.File');

var pool = ClassPool.getDefault();
pool.insertClassPath('c:\\весы\\_extracted');
pool.appendClassPath('c:\\весы\\lib\\DesktopUmagFX-4.1.0.jar');

var outDir = 'c:/весы/_extracted';

print('=== 1. Patching ScalesFactory ===');
var sf = pool.get('kz.umag.scale.lib.libra.ScalesFactory');
var sfMethods = sf.getDeclaredMethods('getScales');
for (var i = 0; i < sfMethods.length; i++) {
    if (sfMethods[i].getSignature().indexOf('Scale;') > 0) {
        sfMethods[i].insertBefore('if ($1 == null || $1.getType() == null) { return null; }');
        print('  ScalesFactory.getScales(Scale) patched with null guard');
        break;
    }
}
sf.writeFile(outDir);
print('  ScalesFactory saved.');

print('\n=== 2. Patching AddScaleUseCase ===');
var uc = pool.get('kz.umag.scale.resource.scale.use_case.AddScaleUseCase');
var ucMethods = uc.getDeclaredMethods('add');
for (var i = 0; i < ucMethods.length; i++) {
    if (ucMethods[i].getSignature().indexOf('Scale;') > 0) {
        ucMethods[i].insertBefore('if ($1 == null || $1.getType() == null) { throw new kz.umag.scale.resource.scale.use_case.AddScaleUseCase$CouldNotReach(this); }');
        print('  AddScaleUseCase.add(Scale) patched with validation guard');
        break;
    }
}
uc.writeFile(outDir);
print('  AddScaleUseCase saved.');

print('\n=== 3. Patching AddScaleControl ===');
var asc = pool.get('kz.umag.scale.ui.AddScaleControl');
var ascSave = asc.getDeclaredMethod('onSave');
ascSave.insertBefore('if (this.typesComboBox.getValue() == null) { this.infoDialog.showAndWait("Внимание", "Пожалуйста, выберите тип весов", getStage()); return; }');
print('  AddScaleControl.onSave() patched with combobox null check');
asc.writeFile(outDir);
print('  AddScaleControl saved.');

print('\n=== 4. Patching StagedControl ===');
var sc = pool.get('kz.umag.scale.ui.StagedControl');
var scPrepare = sc.getDeclaredMethod('prepare');
scPrepare.insertAfter(
    'if ($1 != null && $1.getScene() != null && $2 != null && $2.getScene() != null) {' +
    '  java.util.Iterator it = $2.getScene().getStylesheets().iterator();' +
    '  while (it.hasNext()) {' +
    '    String s = (String) it.next();' +
    '    if (s.indexOf("dark.css") >= 0 && !$1.getScene().getStylesheets().contains(s)) {' +
    '      $1.getScene().getStylesheets().add(s);' +
    '    }' +
    '  }' +
    '}'
);
print('  StagedControl.prepare() patched to propagate dark theme to modal dialogs');
sc.writeFile(outDir);
print('  StagedControl saved.');

print('\n=== 5. Patching TabControl ===');
var tc = pool.get('kz.umag.scale.ui.TabControl');
var btnClass = pool.get('javafx.scene.control.Button');
var tcHasField = false;
try {
    tc.getDeclaredField('themeToggleBtn');
    tcHasField = true;
} catch (e) {}

if (!tcHasField) {
    var f1 = new CtField(btnClass, 'themeToggleBtn', tc);
    f1.setModifiers(Modifier.PUBLIC);
    tc.addField(f1);
    print('  TabControl: themeToggleBtn field added');
}

var tcToggle = tc.getDeclaredMethod('toggleTheme', []);
tcToggle.insertAfter('if (this.themeToggleBtn != null) { this.themeToggleBtn.setText(this.isDarkMode ? "\\u2600" : "\\uD83C\\uDF19"); }');
print('  TabControl.toggleTheme() patched to update button icon (sun/moon)');
tc.writeFile(outDir);
print('  TabControl saved.');

print('\n=== 6. Patching LoginControl ===');
var lc = pool.get('kz.umag.scale.ui.LoginControl');
var lcHasField = false;
try {
    lc.getDeclaredField('themeToggleBtn');
    lcHasField = true;
} catch (e) {}

if (!lcHasField) {
    var f2 = new CtField(btnClass, 'themeToggleBtn', lc);
    f2.setModifiers(Modifier.PUBLIC);
    lc.addField(f2);
    print('  LoginControl: themeToggleBtn field added');
}

var lcToggle = lc.getDeclaredMethod('toggleTheme', []);
lcToggle.insertAfter('if (this.themeToggleBtn != null) { this.themeToggleBtn.setText(this.isDarkMode ? "\\u2600" : "\\uD83C\\uDF19"); }');
print('  LoginControl.toggleTheme() patched to update button icon (sun/moon)');
lc.writeFile(outDir);
print('  LoginControl saved.');

print('\nALL SENIOR DEVELOPER BYTECODE PATCHES APPLIED SUCCESSFULLY!');
