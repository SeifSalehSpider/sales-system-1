const LicenseManager = {
  status: null,

  init() {
    if (!window.nativeStore || !window.nativeStore.getLicenseStatusSync) {
      // Browser version: no trial/licence gate, only the data file connection.
      this.isWeb = true;
      this.initWeb();
      return true;
    }
    this.status = window.nativeStore.getLicenseStatusSync();
    this.ensureModal();
    this.updateActivationStatus();
    if (!this.status.valid) this.show();
    return this.status.valid;
  },

  updateActivationStatus() {
    const statusElement = document.getElementById('activation-status');
    if (!statusElement) return;
    const activated = Boolean(this.status?.activated);
    statusElement.className = `activation-status ${activated ? 'active' : 'inactive'}`;
    statusElement.textContent = activated ? '✅' : '❌';
  },

  ensureModal() {
    if (document.getElementById('license-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'license-modal';
    modal.className = 'license-gate';
    modal.innerHTML = `
      <div class="license-card" dir="rtl">
        <div class="license-icon">🔐</div>
        <h2>تفعيل برنامج الفارس</h2>
        <p id="license-message">يتم التحقق من حالة البرنامج...</p>
        <div class="license-trial-note">يمكنك استخدام البرنامج لمدة 25 يوماً. بعد انتهاء التجربة لديك 7 أيام للتفعيل، ثم سيتم حذف البرنامج وبياناته تلقائياً.</div>
        <input id="license-code-input" type="text" autocomplete="off" placeholder="الصق كود التفعيل هنا">
        <button id="license-activate-btn" class="btn btn-primary btn-block">✅ تفعيل البرنامج</button>
        <small id="license-data-path" class="license-data-path"></small>
        <button id="license-save-permanent" class="btn btn-ghost btn-block" style="display:none;margin-top:10px;">💾 استخدام نسخة الويب بدون اختيار ملف (البيانات داخل المتصفح)</button>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('license-activate-btn').addEventListener('click', () => this.activate());
    document.getElementById('license-code-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.activate();
    });
  },

  show() {
    this.ensureModal();
    const modal = document.getElementById('license-modal');
    const message = document.getElementById('license-message');
    const path = document.getElementById('license-data-path');
    if (message) message.textContent = this.status?.message || 'انتهت الفترة التجريبية';
    if (path && window.nativeStore.getDataPath) path.textContent = `ملف البيانات: ${window.nativeStore.getDataPath()}`;
    modal.classList.add('visible');
    if (this.isWeb) this.updateWebModal();
  },

  // ---------- Browser (GitHub Pages) version ----------
  initWeb() {
    this.ensureModal();
    const button = document.getElementById('license-save-permanent');
    if (button) button.addEventListener('click', () => this.useBrowserOnly());
    window.addEventListener('sales-system:file-mode-changed', () => this.updateWebModal());
    window.addEventListener('sales-system:file-saved', () => this.updateWebModal());
    if (window.browserFlush) window.browserFlush.init();
    const supported = Boolean(window.showSaveFilePicker);
    if (!supported) this.show();
    else this.showFileToast('💾 اضغط على بطاقة البيانات أعلى الصفحة لتحديد ملف حفظ البيانات.');
  },

  updateWebModal() {
    const modal = document.getElementById('license-modal');
    if (!modal) return;
    const title = modal.querySelector('h2');
    const note = modal.querySelector('.license-trial-note');
    const button = document.getElementById('license-save-permanent');
    const input = document.getElementById('license-code-input');
    const activate = document.getElementById('license-activate-btn');
    const message = document.getElementById('license-message');
    const path = document.getElementById('license-data-path');
    if (title) title.textContent = '💾 حفظ بيانات نسخة الويب';
    if (input) input.style.display = 'none';
    if (activate) activate.style.display = 'none';
    if (button) button.style.display = 'inline-flex';
    if (note) {
      note.textContent = window.showSaveFilePicker
        ? 'اختار ملف data.json من جهازك مرة واحدة، وبعدها كل تعديل في البرنامج يتحفظ فيه أوتوماتيك من غير ما تضغط أي زر. النسخة التجريبية تتحفظ تلقائياً داخل المتصفح.'
        : 'المتصفح الحالي مش بيدّعم الحفظ المباشر في ملف، daher سيتم حفظ البيانات داخل المتصفح فقط. استخدم Chrome أو Edge لاختيار ملف data.json.';
    }
    if (!message) return;
    if (window.browserFlush && window.browserFlush.handle) {
      message.textContent = window.browserFlush.dirty
        ? '⏳ جاري الحفظ في الملف...'
        : '✅ متصل بملف البيانات ويتم الحفظ تلقائياً';
    } else {
      message.textContent = 'البيانات حالياً محفوظة داخل المتصفح. اضغط الزر أدناه لتخزينها داخل المتصفح دائماً (أو أعد تحميل الصفحة لتختار ملف data.json).';
    }
    if (path) path.textContent = '';
  },

  useBrowserOnly() {
    if (window.browserFlush) window.browserFlush.markPermanent();
    this.hide();
  },

  showFileToast(text) {
    let toast = document.getElementById('file-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'file-toast';
      toast.className = 'file-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('visible'), 8000);
  },

  hide() {
    const modal = document.getElementById('license-modal');
    if (modal) modal.classList.remove('visible');
  },

  async activate() {
    const input = document.getElementById('license-code-input');
    const button = document.getElementById('license-activate-btn');
    const message = document.getElementById('license-message');
    const code = (input?.value || '').trim();
    if (!code) {
      message.textContent = 'اكتب كود التفعيل أولاً.';
      return;
    }
    button.disabled = true;
    message.textContent = 'جاري التحقق من الكود محلياً...';
    try {
      const result = await window.nativeStore.activate(code);
      if (result.valid) {
        this.status = { ...this.status, ...result, activated: true };
        this.updateActivationStatus();
        this.hide();
        window.location.reload();
      } else {
        message.textContent = result.message || 'كود التفعيل غير صحيح.';
      }
    } catch (_) {
      message.textContent = 'تعذر التحقق من كود التفعيل.';
    } finally {
      button.disabled = false;
    }
  }
};

window.LicenseManager = LicenseManager;
