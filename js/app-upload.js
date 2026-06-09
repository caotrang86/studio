/* AI App upload client — adds drag-drop file upload + processing to tool pages.
   Include this script on each /apps/<slug>/index.html page. */

window.StudioApp = (function () {
  var slug = window.location.pathname.replace(/^\/apps\//, '').replace(/\/$/, '');

  function findUploadZone() {
    // 1. Explicit ID (used by regenerated tool pages)
    var zone = document.getElementById('studio-upload-zone');
    if (zone) return zone;

    // 2. Find the upload icon SVG in original Next.js pages
    var uploadIcon = document.querySelector('[class*="lucide-cloud-upload"]') ||
      document.querySelector('[class*="cloud-upload"]');
    if (!uploadIcon) return null;

    // Walk up to find the large clickable container (cursor-pointer + significant height)
    var el = uploadIcon;
    while (el && el.parentElement) {
      el = el.parentElement;
      if (el.tagName === 'DIV' && el.className) {
        // Look for the main upload container: has cursor-pointer or is the col-span-7 area
        if ((el.className.includes('cursor-pointer') && el.offsetHeight > 100) ||
            el.className.includes('col-span-7')) {
          return el;
        }
      }
    }

    return null;
  }

  function initUpload() {
    var uploadZone = findUploadZone();

    if (!uploadZone) {
      // Create upload zone in main content area as fallback
      var main = document.querySelector('main') || document.querySelector('[class*="container"]');
      if (!main) return;

      uploadZone = document.createElement('div');
      uploadZone.id = 'studio-upload-zone';
      uploadZone.className = 'max-w-xl mx-auto mt-8 p-8 border-2 border-dashed border-cyan-500/30 rounded-xl text-center cursor-pointer hover:border-cyan-500/60 transition-all bg-[#0d1117]/50';
      uploadZone.innerHTML =
        '<div class="flex flex-col items-center gap-4">' +
        '<svg class="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>' +
        '<p class="text-lg font-medium text-white">Kéo & thả file vào đây</p>' +
        '<p class="text-sm text-gray-400">hoặc click để chọn file — tối đa 50MB</p>' +
        '<input type="file" id="studio-file-input" class="hidden" accept="image/*,video/*,audio/*,.txt">' +
        '</div>';

      var insertBefore = main.querySelector('section') || main.querySelector('h1') || main.firstChild;
      main.insertBefore(uploadZone, insertBefore);
    }

    // Results area — insert AFTER the upload zone's parent column or zone itself
    var resultsArea = document.getElementById('studio-results');
    if (!resultsArea) {
      resultsArea = document.createElement('div');
      resultsArea.id = 'studio-results';
      resultsArea.className = 'mt-6 hidden';

      // Try to place inside the col-span-7 area or right after upload zone
      var colContainer = uploadZone.closest('[class*="col-span-7"]') || uploadZone.parentElement;
      if (colContainer) {
        colContainer.appendChild(resultsArea);
      } else {
        uploadZone.parentElement.insertBefore(resultsArea, uploadZone.nextSibling);
      }
    }

    // File input — use existing or create new
    var fileInput = document.getElementById('studio-file-input') || uploadZone.querySelector('input[type="file"]');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'studio-file-input';
      fileInput.className = 'hidden';
      fileInput.accept = 'image/*,video/*,audio/*,.txt';
      uploadZone.appendChild(fileInput);
    }

    // Click to upload — prevent event bubbling issues with nested elements
    uploadZone.addEventListener('click', function (e) {
      // Don't trigger if clicking on a button, link, or the file input itself
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) processFile(fileInput.files[0]);
    });

    // Drag & drop
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadZone.style.opacity = '0.7';
    });
    uploadZone.addEventListener('dragleave', function () {
      uploadZone.style.opacity = '1';
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadZone.style.opacity = '1';
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
      '<span class="text-white">Đang xử lý ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)...</span>' +
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
            '<p class="text-red-400">' + (r.data.error || 'Đã xảy ra lỗi') + '</p>' +
            (r.data.message ? '<p class="text-gray-400 text-sm mt-2">' + r.data.message + '</p>' : '') +
            '</div>';
          return;
        }

        // Success
        var data = r.data;
        var outputUrl = data.output_url || '';
        var ext = outputUrl.split('.').pop().toLowerCase();
        var isVideo = ext === 'mp4' || ext === 'mov' || ext === 'webm' || file.type.startsWith('video/');
        var isAudio = ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'aac' || file.type.startsWith('audio/');
        var isArchive = ext === 'gz' || ext === 'zip' || ext === 'tar';
        var preview = '';

        if (isVideo) {
          preview = '<video src="' + outputUrl + '" controls class="w-full rounded-lg max-h-[400px]"></video>';
        } else if (isAudio) {
          preview = '<audio src="' + outputUrl + '" controls class="w-full"></audio>';
        } else if (isArchive) {
          preview = '<div class="flex items-center gap-3 p-4 bg-[#0d1117] rounded-lg"><svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg><span class="text-white">File đã sẵn sàng tải</span></div>';
        } else {
          preview = '<img src="' + outputUrl + '" class="w-full rounded-lg max-h-[400px] object-contain bg-[#0d1117]" alt="Kết quả">';
        }

        resultsArea.innerHTML =
          '<div class="bg-[#1a1f2e] rounded-xl p-6 border border-green-500/30">' +
          '<p class="text-green-400 text-lg font-medium mb-2">Xử lý thành công!</p>' +
          '<p class="text-gray-400 text-sm mb-4">Credits còn lại: ' + data.credits_remaining + '</p>' +
          '<div class="mb-4">' + preview + '</div>' +
          '<a href="' + outputUrl + '" download class="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2.5 rounded-lg transition-colors font-medium">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
          'Tải xuống kết quả</a>' +
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
