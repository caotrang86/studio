/* AI App upload client — adds drag-drop file upload + processing to tool pages.
   Include this script on each /apps/<slug>/index.html page. */

window.StudioApp = (function () {
  var slug = window.location.pathname.replace(/^\/apps\//, '').replace(/\/$/, '');

  function initUpload() {
    // Find or create the upload zone
    var uploadZone = document.getElementById('studio-upload-zone');
    if (!uploadZone) {
      // Try to find the existing static upload area and enhance it
      var existingUpload = document.querySelector('[class*="cloud-upload"]') ||
        document.querySelector('[class*="lucide-cloud-upload"]');
      var container = existingUpload ? existingUpload.closest('div[class*="border-dashed"], div[class*="rounded"]') : null;

      if (!container) {
        // Create upload zone in main content area
        var main = document.querySelector('main') || document.querySelector('[class*="container"]');
        if (!main) return;

        container = document.createElement('div');
        container.id = 'studio-upload-zone';
        container.className = 'max-w-xl mx-auto mt-8 p-8 border-2 border-dashed border-cyan-500/30 rounded-xl text-center cursor-pointer hover:border-cyan-500/60 transition-all bg-[#0d1117]/50';
        container.innerHTML =
          '<div class="flex flex-col items-center gap-4">' +
          '<svg class="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>' +
          '<p class="text-lg font-medium text-white">Kéo & thả file vào đây</p>' +
          '<p class="text-sm text-gray-400">hoặc click để chọn file (JPG, PNG, WEBP, MP4 — tối đa 20MB)</p>' +
          '<input type="file" id="studio-file-input" class="hidden" accept="image/*,video/*">' +
          '</div>';

        // Insert before the first section or at the top
        var insertBefore = main.querySelector('section') || main.firstChild;
        main.insertBefore(container, insertBefore);
      }

      uploadZone = container;
    }

    // Results area
    var resultsArea = document.getElementById('studio-results');
    if (!resultsArea) {
      resultsArea = document.createElement('div');
      resultsArea.id = 'studio-results';
      resultsArea.className = 'max-w-xl mx-auto mt-6 hidden';
      uploadZone.parentElement.insertBefore(resultsArea, uploadZone.nextSibling);
    }

    // File input
    var fileInput = uploadZone.querySelector('input[type="file"]') || document.getElementById('studio-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'studio-file-input';
      fileInput.className = 'hidden';
      fileInput.accept = 'image/*,video/*';
      uploadZone.appendChild(fileInput);
    }

    // Click to upload
    uploadZone.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) processFile(fileInput.files[0]);
    });

    // Drag & drop
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadZone.classList.add('border-cyan-400', 'bg-cyan-500/5');
    });
    uploadZone.addEventListener('dragleave', function () {
      uploadZone.classList.remove('border-cyan-400', 'bg-cyan-500/5');
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadZone.classList.remove('border-cyan-400', 'bg-cyan-500/5');
      if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    });
  }

  function processFile(file) {
    var resultsArea = document.getElementById('studio-results');

    // Show loading state
    resultsArea.classList.remove('hidden');
    resultsArea.innerHTML =
      '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-white/10">' +
      '<div class="flex items-center gap-3">' +
      '<div class="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full"></div>' +
      '<span class="text-white">Đang xử lý...</span>' +
      '</div></div>';

    var formData = new FormData();
    formData.append('file', file);

    fetch('/api/apps/' + slug + '/process', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (r) {
        if (r.status === 401) {
          resultsArea.innerHTML =
            '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-yellow-500/30 text-center">' +
            '<p class="text-yellow-400 text-lg font-medium mb-2">Cần đăng nhập</p>' +
            '<p class="text-gray-400 mb-4">Bạn cần đăng nhập để sử dụng công cụ này</p>' +
            '<a href="/login" class="inline-block bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors">Đăng nhập</a>' +
            '</div>';
          return;
        }
        if (r.status === 402) {
          resultsArea.innerHTML =
            '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-red-500/30 text-center">' +
            '<p class="text-red-400 text-lg font-medium mb-2">Không đủ credits</p>' +
            '<p class="text-gray-400 mb-4">Cần ' + r.data.credits_needed + ' credits. Bạn có ' + r.data.credits_available + ' credits.</p>' +
            '<a href="/pricing" class="inline-block bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors">Mua thêm credits</a>' +
            '</div>';
          return;
        }
        if (r.status !== 200) {
          resultsArea.innerHTML =
            '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-red-500/30">' +
            '<p class="text-red-400">' + (r.data.error || 'Đã xảy ra lỗi') + '</p></div>';
          return;
        }

        // Success
        var data = r.data;
        var isVideo = file.type.startsWith('video/');
        resultsArea.innerHTML =
          '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-green-500/30">' +
          '<p class="text-green-400 text-lg font-medium mb-2">Xử lý thành công!</p>' +
          '<p class="text-gray-400 text-sm mb-4">Credits còn lại: ' + data.credits_remaining + '</p>' +
          '<div class="mb-4">' +
          (isVideo
            ? '<video src="' + data.output_url + '" controls class="w-full rounded-lg"></video>'
            : '<img src="' + data.output_url + '" class="w-full rounded-lg" alt="Kết quả">') +
          '</div>' +
          '<a href="' + data.output_url + '" download class="inline-block bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors">' +
          'Tải xuống kết quả</a>' +
          '<p class="text-gray-500 text-xs mt-3">' + data.message + '</p>' +
          '</div>';
      })
      .catch(function (err) {
        resultsArea.innerHTML =
          '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-red-500/30">' +
          '<p class="text-red-400">Lỗi kết nối server</p></div>';
      });
  }

  return { initUpload: initUpload };
})();

// Auto-init on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', StudioApp.initUpload);
} else {
  StudioApp.initUpload();
}
