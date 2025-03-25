document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const exportBtn = document.getElementById('exportBtn');
    const container = document.getElementById('translationGrid');
  
    let hot;
    let translations = {};
    let fileNames = [];
  
    fileInput.addEventListener('change', handleFiles);
    exportBtn.addEventListener('click', exportTranslations);
  
    function handleFiles(event) {
        const files = event.target.files;
        if (files.length === 0) return;
      
        if (fileNames.length > 0) {
          const confirmed = confirm(
            "⚠️ You already have files loaded.\nLoading new files will discard your changes.\n\nDo you want to continue?"
          );
          if (!confirmed) {
            // Reset input so user can re-select same files later
            fileInput.value = '';
            return;
          }
        }
      
        translations = {};
        fileNames = [];
      
        const filePromises = Array.from(files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const content = JSON.parse(e.target.result);
                translations[file.name] = content;
                fileNames.push(file.name);
                resolve();
              } catch (err) {
                reject(`Error parsing ${file.name}: ${err.message}`);
              }
            };
            reader.onerror = () => reject(`Error reading ${file.name}`);
            reader.readAsText(file);
          });
        });
      
        Promise.all(filePromises)
          .then(() => initializeGrid())
          .catch(error => alert(error));
      }
      
  
    function initializeGrid() {
      const allKeys = new Set();
      fileNames.forEach(file => {
        Object.keys(translations[file]).forEach(key => allKeys.add(key));
      });
  
      const data = Array.from(allKeys).map(key => {
        const row = [key];
        fileNames.forEach(file => {
          row.push(translations[file][key] || '');
        });
        return row;
      });
  
      const colHeaders = ['Key', ...fileNames];
  
      //if (hot) hot.destroy();
  
      hot = new Handsontable(container, {
        data: data,
        colHeaders: colHeaders,
        rowHeaders: true,
        contextMenu: true,
        manualRowMove: true,
        manualColumnMove: true,
        manualColumnResize: true,
        colWidths: [200, ...fileNames.map(() => 300)],
        filters: false,
        dropdownMenu: true,
        minSpareRows: 1,
        licenseKey: 'non-commercial-and-evaluation',
        
        columns: colHeaders.map((header, colIndex) => ({
          renderer: function (instance, td, row, col, prop, value, cellProperties) {
            // 💣 Remove all dynamic classes first
            td.classList.remove('htMissing', 'htDuplicate');
        
            const key = instance.getDataAtCell(row, 0);
            const totalRows = instance.countRows();
            const isSpareRow = row === totalRows - 1;
        
            // 🔴 Apply missing if needed
            if (col > 0 && !isSpareRow && (!value || value.trim() === '')) {
              td.classList.add('htMissing');
            }
        
            // 🔴 Apply duplicate if needed
            if (col === 0 && !isSpareRow) {
              const allKeys = instance.getDataAtCol(0);
              const duplicates = allKeys.filter(k => k === key);
              if (key && duplicates.length > 1) {
                td.classList.add('htDuplicate');
              }
            }
        
            // 🧼 Finally render the text
            Handsontable.renderers.TextRenderer.apply(this, arguments);
          }
        })),
        
  
        afterChange: (changes, source) => {
          if (source === 'edit' && changes) {
            changes.forEach(([row, col, oldValue, newValue]) => {
              const key = hot.getDataAtCell(row, 0);
              if (!key) return;
  
              if (col > 0) {
                const file = fileNames[col - 1];
                translations[file][key] = newValue;
              }
  
              // Update translations if key name changed
              if (col === 0 && oldValue !== newValue) {
                fileNames.forEach((file, idx) => {
                  const oldVal = translations[file][oldValue];
                  delete translations[file][oldValue];
                  if (oldVal !== undefined) {
                    translations[file][newValue] = oldVal;
                  }
                });
              }
            });
          }
          if (hot && typeof hot.render === 'function') {
            hot.render();
          } // Re-render to apply duplicate highlighting
        }
      });
    }
  
    function exportTranslations() {
      const keys = hot.getDataAtCol(0);
      const duplicates = keys.filter((item, index) => keys.indexOf(item) !== index && item);
      if (duplicates.length > 0) {
        alert("❌ Cannot export. Duplicate keys found:\n" + [...new Set(duplicates)].join('\n'));
        return;
      }
  
      const updatedData = hot.getData();
      const newTranslations = {};
  
      // Prepare empty translation objects
      fileNames.forEach(file => {
        newTranslations[file] = {};
      });
  
      updatedData.forEach(row => {
        const key = row[0];
        if (!key) return;
  
        fileNames.forEach((file, index) => {
          if(!row[index + 1]) return;
          newTranslations[file][key] = row[index + 1] || '';
        });
      });
  
      const zip = new JSZip();
      fileNames.forEach(file => {
        const content = JSON.stringify(newTranslations[file], null, 2);
        zip.file(file, content);
      });
  
      zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'translations.zip';
        link.click();
      });
    }
  });
  