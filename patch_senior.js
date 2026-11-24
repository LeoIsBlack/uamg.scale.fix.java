// =============================================================================
// patch_senior.js — ИСТОРИЧЕСКИЕ патчи байткода (null-проверки, propagation темы).
//
// Эти шаги УЖЕ применены к классам в _extracted/ (классы хранятся в git).
// Скрипт не идемпотентен (insertBefore / insertAfter), поэтому при повторном
// запуске он сам останавливается, если видит следы прошлого применения.
// Новые патчи добавляйте в patch_ui.js — он идемпотентен.
//
// Запуск из корня репозитория:
//     jre\bin\jjs.exe -cp lib\javassist-3.24.0-GA.jar patch_senior.js
// =============================================================================

var ClassPool = Java.type('javassist.ClassPool');
var CtField = Java.type('javassist.CtField');
var Modifier = Java.type('javassist.Modifier');
var File = Java.type('java.io.File');

var ROOT = new File(__DIR__).getAbsolutePath();
var outDir = ROOT + File.separator + '_extracted';

var pool = ClassPool.getDefault();
pool.insertClassPath(outDir);
pool.appendClassPath(ROOT + File.separator + 'lib' + File.separator + 'DesktopUmagFX-4.1.0.jar');

function hasField(ct, name) {
    try { ct.getDeclaredField(name); return true; } catch (e) { return false; }
}

if (hasField(pool.get('kz.umag.scale.ui.TabControl'), 'themeToggleBtn')) {
    print('patch_senior.js уже применён к _extracted/ — повторный запуск пропущен.');
    print('Новые патчи: jre\\bin\\jjs.exe -cp lib\\javassist-3.24.0-GA.jar patch_ui.js');
} else {
    applyLegacyPatches();
}

function applyLegacyPatches() {
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

    print('\n=== 3. Patching AddScaleControl ===');
    var asc = pool.get('kz.umag.scale.ui.AddScaleControl');
    asc.getDeclaredMethod('onSave').insertBefore(
        'if (this.typesComboBox.getValue() == null) { this.infoDialog.showAndWait("Внимание", "Пожалуйста, выберите тип весов", getStage()); return; }');
    print('  AddScaleControl.onSave() patched with combobox null check');
    asc.writeFile(outDir);

    print('\n=== 4. Patching StagedControl ===');
    var sc = pool.get('kz.umag.scale.ui.StagedControl');
    sc.getDeclaredMethod('prepare').insertAfter(
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

    // Шаги 5-6 менялись: Javassist не понимает \u-экранирование в строках Java,
    // и раньше в кнопку попадал текст "u2600". Символы теперь строятся из кодов.
    // В актуальной сборке тело toggleTheme() всё равно заменяет patch_ui.js.
    var btnClass = pool.get('javafx.scene.control.Button');
    var icon = 'this.themeToggleBtn.setText(this.isDarkMode'
        + ' ? String.valueOf(Character.toChars(0x2600))'
        + ' : String.valueOf(Character.toChars(0x1F319)));';
    ['kz.umag.scale.ui.TabControl', 'kz.umag.scale.ui.LoginControl'].forEach(function (name, n) {
        print('\n=== ' + (5 + n) + '. Patching ' + name + ' ===');
        var ct = pool.get(name);
        if (!hasField(ct, 'themeToggleBtn')) {
            var f = new CtField(btnClass, 'themeToggleBtn', ct);
            f.setModifiers(Modifier.PUBLIC);
            ct.addField(f);
        }
        ct.getDeclaredMethod('toggleTheme', []).insertAfter('if (this.themeToggleBtn != null) { ' + icon + ' }');
        print('  ' + name + '.toggleTheme() patched to update button icon');
        ct.writeFile(outDir);
    });

    print('\nLegacy patches applied.');
}
