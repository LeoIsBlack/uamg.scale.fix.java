// =============================================================================
// patch_ui.js — патчи байткода для UI: единая тема, исправления таблиц, запуск.
//
// Запуск из корня репозитория (классы пишутся в _extracted/):
//     jre\bin\jjs.exe -cp "lib\*" patch_ui.js
//
// Скрипт ИДЕМПОТЕНТЕН: тела методов заменяются целиком (setBody), а вставки
// (insertBefore / insertAfter / instrument) защищены статическим полем-маркером
// UMAG_PATCH_UI в классе. Повторный запуск ничего не дублирует.
// Строки с кириллицей в Java-коде записаны через \u-экранирование JavaScript,
// чтобы результат не зависел от кодировки, в которой jjs читает этот файл.
// =============================================================================

var ClassPool = Java.type('javassist.ClassPool');
var CtField = Java.type('javassist.CtField');
var CtNewMethod = Java.type('javassist.CtNewMethod');
var CtNewConstructor = Java.type('javassist.CtNewConstructor');
var ConstPool = Java.type('javassist.bytecode.ConstPool');
var ExprEditor = Java.type('javassist.expr.ExprEditor');
var MethodCall = Java.type('javassist.expr.MethodCall');
var File = Java.type('java.io.File');

var ROOT = new File(__DIR__).getAbsolutePath();
var OUT = ROOT + File.separator + '_extracted';
var LIB = ROOT + File.separator + 'lib';
var MARKER = 'UMAG_PATCH_UI';

var pool = new ClassPool(true);
pool.insertClassPath(OUT);
pool.appendClassPath(LIB + File.separator + 'DesktopUmagFX-4.1.0.jar');
// Зависимости нужны Javassist для пересчёта StackMapTable (kotlin.Pair, JFoenix и т.д.)
Java.from(new File(LIB).listFiles()).forEach(function (f) {
    var n = f.getName();
    if (/\.jar$/.test(n) && n != 'DesktopUmagFX-4.1.0.jar') pool.appendClassPath(f.getAbsolutePath());
});

function hasField(ct, name) {
    try { ct.getDeclaredField(name); return true; } catch (e) { return false; }
}

// Применяет fn к классу один раз: после применения в классе остаётся поле-маркер.
function once(ct, label, fn) {
    if (hasField(ct, MARKER)) {
        print('  [skip] ' + label + ' (уже применено)');
        return;
    }
    fn();
    ct.addField(CtField.make('public static final boolean ' + MARKER + ' = true;', ct));
    print('  [ok]   ' + label);
}

function method(ct, name, desc) {
    return desc ? ct.getMethod(name, desc) : ct.getDeclaredMethod(name);
}

function setBody(ct, name, desc, body, label) {
    method(ct, name, desc).setBody(body);
    print('  [ok]   ' + label);
}

// Класс сначала целиком собирается в памяти и только потом пишется на диск.
// CtClass.writeFile() пишет в тот же файл, из которого класс мог быть прочитан
// лениво, и при повторном запуске обрезал StagedControl.class до 8192 байт.
var Files = Java.type('java.nio.file.Files');
function save(ct) {
    var bytes = ct.toBytecode();
    var f = new File(OUT, ct.getName().replace(/\./g, '/') + '.class');
    f.getParentFile().mkdirs();
    Files.write(f.toPath(), bytes);
}

var RU_VERSION = '\u0412\u0435\u0440\u0441\u0438\u044f '; // "Версия " — \u-экранирование, см. шапку файла

// -----------------------------------------------------------------------------
print('=== 1. kz.umag.scale.ui.Theme (новый класс: состояние темы для всех окон)');
// -----------------------------------------------------------------------------
var theme = pool.makeClass('kz.umag.scale.ui.Theme');
theme.addInterface(pool.get('javafx.collections.ListChangeListener'));
theme.addField(CtField.make('private static boolean dark;', theme));
theme.addField(CtField.make('private static boolean installed;', theme));
theme.addField(CtField.make('private static String darkUrl;', theme));
theme.addConstructor(CtNewConstructor.defaultConstructor(theme));
[
    'public static boolean isDark() { return dark; }',

    'public static String darkUrl() {' +
    '  if (darkUrl == null) {' +
    '    java.net.URL u = kz.umag.scale.ui.Theme.class.getResource("/styles/dark.css");' +
    '    darkUrl = (u == null) ? "" : u.toExternalForm();' +
    '  }' +
    '  return darkUrl;' +
    '}',

    // Подключает или снимает dark.css у сцены в зависимости от текущей темы.
    'public static void apply(javafx.scene.Scene scene) {' +
    '  if (scene == null) return;' +
    '  String url = darkUrl();' +
    '  if (url.length() == 0) return;' +
    '  javafx.collections.ObservableList sheets = scene.getStylesheets();' +
    '  if (dark) { if (!sheets.contains(url)) sheets.add(url); }' +
    '  else { while (sheets.remove(url)) { } }' +
    '}',

    'public static void applyAll() {' +
    '  try {' +
    '    java.util.List stages = new java.util.ArrayList(com.sun.javafx.stage.StageHelper.getStages());' +
    '    for (int i = 0; i < stages.size(); i++) {' +
    '      Object o = stages.get(i);' +
    '      if (o instanceof javafx.stage.Window) apply(((javafx.stage.Window) o).getScene());' +
    '    }' +
    '  } catch (Throwable t) { t.printStackTrace(); }' +
    '}',

    'private static void load() {' +
    '  try { dark = java.util.prefs.Preferences.userRoot().node("kz/umag/scale").getBoolean("darkTheme", false); }' +
    '  catch (Throwable t) { dark = false; }' +
    '}',

    'private static void save() {' +
    '  try {' +
    '    java.util.prefs.Preferences p = java.util.prefs.Preferences.userRoot().node("kz/umag/scale");' +
    '    p.putBoolean("darkTheme", dark);' +
    '    p.flush();' +
    '  } catch (Throwable t) { }' +
    '}',

    // Переключение кнопкой: сохраняет выбор и перекрашивает все открытые окна.
    'public static void toggle() { dark = !dark; save(); applyAll(); }',

    // Вызывается один раз при старте: читает сохранённую тему и подписывается на
    // появление новых окон, чтобы каждый диалог сразу открывался в нужной теме.
    'public static void install() {' +
    '  if (installed) return;' +
    '  installed = true;' +
    '  load();' +
    '  try {' +
    '    com.sun.javafx.stage.StageHelper.getStages().addListener(' +
    '        (javafx.collections.ListChangeListener) new kz.umag.scale.ui.Theme());' +
    '  } catch (Throwable t) { t.printStackTrace(); }' +
    '  applyAll();' +
    '}',

    // Код диалогов принудительно ставит "-fx-background-color: white" инлайн-стилем,
    // который не перекрывается CSS. В тёмной теме: корню диалога — пусто (цвет из
    // dark.css), подложке без затемнения — тёмный фон.
    'public static String inlineStyle(String style, boolean dialogRoot) {' +
    '  if (!dark || style == null || style.indexOf("white") < 0) return style;' +
    '  return dialogRoot ? "" : "-fx-background-color: #0f172a";' +
    '}',

    // Тёмно-серые цвета текста, заданные кодом (#212121, #4F4F4F, ...), в тёмной теме
    // заменяются светлым; цветные (красный, зелёный) остаются как есть.
    'public static String textColor(String color) {' +
    '  if (!dark || color == null) return color;' +
    '  try {' +
    '    if (javafx.scene.paint.Color.web(color).getBrightness() < 0.45) return "#e2e8f0";' +
    '  } catch (Throwable t) { }' +
    '  return color;' +
    '}',

    'public void onChanged(javafx.collections.ListChangeListener$Change c) {' +
    '  while (c.next()) {' +
    '    if (c.wasAdded()) {' +
    '      java.util.List added = c.getAddedSubList();' +
    '      for (int i = 0; i < added.size(); i++) {' +
    '        Object o = added.get(i);' +
    '        if (o instanceof javafx.stage.Window) apply(((javafx.stage.Window) o).getScene());' +
    '      }' +
    '    }' +
    '  }' +
    '}'
].forEach(function (src) { theme.addMethod(CtNewMethod.make(src, theme)); });
save(theme);
print('  [ok]   Theme записан');

// -----------------------------------------------------------------------------
print('\n=== 2. ScaleApp: установка темы при старте, без Win+D');
// -----------------------------------------------------------------------------
var app = pool.get('kz.umag.scale.app.ScaleApp');
once(app, 'start(): Theme.install()', function () {
    app.getDeclaredMethod('start').insertBefore(
        '{ try { kz.umag.scale.ui.Theme.install(); } catch (Throwable t) { t.printStackTrace(); } }');
});
// Остаток киоск-режима: при запуске нажимал Win+D и сворачивал все окна пользователя.
setBody(app, 'hideAllWindows', null, '{ }', 'hideAllWindows(): больше не сворачивает чужие окна');
save(app);

// -----------------------------------------------------------------------------
print('\n=== 3. Кнопка темы в TabControl и LoginControl');
// -----------------------------------------------------------------------------
['kz.umag.scale.ui.TabControl', 'kz.umag.scale.ui.LoginControl'].forEach(function (name) {
    var ct = pool.get(name);
    // Раньше: свой флаг isDarkMode в каждом экране (рассинхрон login -> main) и текст
    // кнопки "u2600" из-за неподдерживаемого Javassist экранирования \u. Теперь иконку
    // рисует CSS, а состояние хранит Theme.
    setBody(ct, 'toggleTheme', '()V', '{ kz.umag.scale.ui.Theme.toggle(); }', name + '.toggleTheme()');
    setBody(ct, 'toggleTheme', '(Ljavafx/event/ActionEvent;)V', '{ kz.umag.scale.ui.Theme.toggle(); }',
        name + '.toggleTheme(ActionEvent)');
    if (name == 'kz.umag.scale.ui.TabControl') {
        // Часы в шапке обновлялись раз в 60 с и могли отставать почти на минуту.
        var mi = ct.getDeclaredMethod('postLoad').getMethodInfo();
        var cp = mi.getConstPool();
        var it = mi.getCodeAttribute().iterator();
        var fixed = 0;
        while (it.hasNext()) {
            var pos = it.next();
            if (it.byteAt(pos) == 0x14) { // ldc2_w
                var idx = it.u16bitAt(pos + 1);
                if (cp.getTag(idx) == ConstPool.CONST_Double && cp.getDoubleInfo(idx) == 60000.0) {
                    it.write16bit(cp.addDoubleInfo(5000.0), pos + 1);
                    fixed++;
                }
            }
        }
        print(fixed ? '  [ok]   postLoad(): часы обновляются каждые 5 с' : '  [skip] postLoad(): часы (уже применено)');
    } else {
        once(ct, 'LoginControl.postLoad(): реальная версия на экране входа', function () {
            ct.getDeclaredMethod('postLoad').insertAfter(
                '{ try {' +
                '  javafx.scene.Node n = this.root == null ? null : this.root.lookup("#loginVersion");' +
                '  if (n instanceof javafx.scene.text.Text) ((javafx.scene.text.Text) n).setText("' + RU_VERSION + '" + kz.umag.scale.app.configs.BuildConfigs.getVersion());' +
                '} catch (Throwable t) { } }');
        });
    }
    save(ct);
});

// -----------------------------------------------------------------------------
print('\n=== 4. Диалоги: фон и цвет текста по теме');
// -----------------------------------------------------------------------------
var StyleEditor = Java.extend(ExprEditor, {
    edit: function (e) {
        if (e instanceof MethodCall && e.getMethodName() == 'setStyle') {
            e.replace('{ $proceed(kz.umag.scale.ui.Theme.inlineStyle($1, ((Object) $0) == ((Object) this.root))); }');
        }
    }
});
['kz.umag.scale.ui.StagedControl', 'kz.umag.scale.ui.dialog.ModalDialogNew'].forEach(function (name) {
    var ct = pool.get(name);
    once(ct, name + '.prepare(): фон диалога по теме', function () {
        ct.getDeclaredMethod('prepare').instrument(new StyleEditor());
        if (name == 'kz.umag.scale.ui.dialog.ModalDialogNew') {
            ct.getDeclaredMethod('setTitleText').insertBefore('{ $2 = kz.umag.scale.ui.Theme.textColor($2); }');
        }
    });
    save(ct);
});

var tb = pool.get('kz.umag.scale.ui.dialog.decorator.TextBuilder');
once(tb, 'TextBuilder: цвет строк сообщений по теме', function () {
    tb.getDeclaredMethod('createText').insertBefore('{ $2 = kz.umag.scale.ui.Theme.textColor($2); }');
    tb.getDeclaredMethod('singleContent').instrument(new (Java.extend(ExprEditor, {
        edit: function (e) {
            if (e instanceof MethodCall && e.getClassName() == 'javafx.scene.paint.Paint' && e.getMethodName() == 'valueOf') {
                e.replace('{ $_ = $proceed(kz.umag.scale.ui.Theme.textColor($1)); }');
            }
        }
    }))());
});
save(tb);

// -----------------------------------------------------------------------------
print('\n=== 5. Таблица синхронизации: «залипший» текст, ошибки клика, цвета');
// -----------------------------------------------------------------------------
var ccf = pool.get('kz.umag.scale.ui.component.table.ColoringCellFactory$1');
// Раньше: при пустом значении текст не очищался (в пустых строках и у товаров без
// штрихкода показывались данные другого товара), а цвет задавался инлайн-стилем,
// который не меняется в тёмной теме. Теперь ошибка — CSS-класс cellError.
setBody(ccf, 'updateItem', '(Ljava/lang/Object;Z)V',
    '{' +
    '  super.updateItem($1, $2);' +
    '  this.getStyleClass().remove("cellError");' +
    '  this.setStyle("");' +
    '  if ($2 || $1 == null) { this.setText(null); return; }' +
    '  this.setText($1.toString());' +
    '  javafx.scene.control.TableRow row = this.getTableRow();' +
    '  Object item = (row == null) ? null : row.getItem();' +
    '  if (item instanceof kz.umag.scale.resource.nom.dto.ProductAndError) {' +
    '    java.util.Map problems = ((kz.umag.scale.resource.nom.dto.ProductAndError) item).problemItems;' +
    '    if (problems != null && problems.get(kz.umag.scale.ui.component.table.ColoringCellFactory.access$000(this.this$0)) != null) {' +
    '      this.getStyleClass().add("cellError");' +
    '    }' +
    '  }' +
    '}', 'ColoringCellFactory$1.updateItem()');
save(ccf);

var del = pool.get('kz.umag.scale.ui.SyncControl$1');
setBody(del, 'updateItem', '(Ljava/lang/Number;Z)V',
    '{' +
    '  super.updateItem($1, $2);' +
    '  if ($2 || $1 == null) { this.val$imageview.setImage(null); }' +
    '  else if (this.val$imageview.getImage() == null) {' +
    '    this.val$imageview.setImage(new javafx.scene.image.Image("/image/delete-row.png"));' +
    '  }' +
    '}', 'SyncControl$1.updateItem(): иконка удаления не остаётся в пустых строках');
save(del);

var err = pool.get('kz.umag.scale.ui.SyncControl$2');
setBody(err, 'updateItem', '(Ljava/lang/String;Z)V',
    '{' +
    '  super.updateItem($1, $2);' +
    '  if ($2 || $1 == null) { this.val$imageview.setImage(null); this.setText(null); }' +
    '  else {' +
    '    if (this.val$imageview.getImage() == null) this.val$imageview.setImage(new javafx.scene.image.Image("/image/problem.png"));' +
    '    this.setText($1);' +
    '  }' +
    '}', 'SyncControl$2.updateItem(): текст ошибки не остаётся в пустых строках');
save(err);

var sync = pool.get('kz.umag.scale.ui.SyncControl');
setBody(sync, 'lambda$null$7', null,
    '{' +
    '  int i = $1.getIndex();' +
    '  if (!$1.isEmpty() && i >= 0 && i < this.products.size()) { this.products.remove(i); }' +
    '}', 'SyncControl: клик по пустой строке колонки удаления больше не бросает исключение');
setBody(sync, 'lambda$initTableView$10', null,
    '{ return new javafx.beans.property.SimpleObjectProperty(' +
    '    ((kz.umag.scale.resource.nom.dto.ProductAndError) $1.getValue()).getBarcode()); }',
    'SyncControl: колонка «Штрихкод» не падает на товаре без штрихкода');
setBody(sync, 'lambda$initTableView$6', null,
    '{ Long b = ((kz.umag.scale.resource.nom.dto.ProductAndError) $1.getValue()).getBarcode();' +
    '  return new javafx.beans.property.SimpleLongProperty(b == null ? 0L : b.longValue()); }',
    'SyncControl: колонка удаления не падает на товаре без штрихкода');
save(sync);

print('\nГотово. Дальше: jre\\bin\\jjs.exe -cp "lib\\*" repack_final.js');
