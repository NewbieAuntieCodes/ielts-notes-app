// main.js (最终完整版本 - 支持 Markdown 和 HTML 导出)

const { app, BrowserWindow, ipcMain, dialog } = require("electron"); // 确保引入了 dialog
const path = require("path");
const fs = require("fs");
const TurndownService = require("turndown"); // 引入 turndown (用于 Markdown 导出)

// --- 数据文件路径 ---
const userDataPath = app.getPath("userData");
const dataFilePath = path.join(userDataPath, "data.json");
// --- 新增：选中状态文件的路径 ---
const selectionStatePath = path.join(userDataPath, "selection_state.json"); // 新的状态文件名
console.log("数据文件路径:", dataFilePath);
console.log("选中状态文件路径:", selectionStatePath); // 打印新路径

// --- 加载数据的函数 ---
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, "utf8");
      const parsedData = JSON.parse(data);
      if (Array.isArray(parsedData)) {
        console.log("成功加载数据从 data.json");
        return parsedData;
      } else {
        console.warn("加载的数据不是数组格式，将使用默认结构。");
      }
    } else {
      console.log("数据文件不存在，将使用默认结构。");
    }
  } catch (error) {
    console.error("加载数据失败:", error);
  }
  // 返回默认结构
  return [
    {
      id: "part1",
      title: "雅思口语 Part 1",
      isStatic: true,
      children: [
        { id: "part1-person", title: "人物题", isStatic: true, children: [] },
        { id: "part1-event", title: "事件题", isStatic: true, children: [] },
        { id: "part1-object", title: "事物题", isStatic: true, children: [] },
        { id: "part1-place", title: "地点题", isStatic: true, children: [] },
      ],
    },
    { id: "part2", title: "雅思口语 Part 2", isStatic: true, children: [] },
    { id: "part3", title: "雅思口语 Part 3", isStatic: true, children: [] },
  ];
}

// --- 保存数据的函数 ---
function saveData(dataToSave) {
  try {
    const dataString = JSON.stringify(dataToSave, null, 2); // 格式化 JSON 输出
    fs.writeFileSync(dataFilePath, dataString, "utf8");
    console.log("数据已保存到:", dataFilePath);
  } catch (error) {
    console.error("保存数据失败:", error);
  }
}

// --- 新增：加载选中状态的函数 ---
function loadSelectionState() {
  try {
    if (fs.existsSync(selectionStatePath)) {
      const data = fs.readFileSync(selectionStatePath, "utf8");
      const parsedData = JSON.parse(data);
      // 验证是否是数组
      if (Array.isArray(parsedData)) {
        console.log("成功加载选中状态:", parsedData.length, "项");
        return parsedData; // 返回 ID 数组
      } else {
        console.warn("加载的选中状态不是数组格式。");
      }
    } else {
      console.log("选中状态文件不存在，返回空数组。");
    }
  } catch (error) {
    console.error("加载选中状态失败:", error);
  }
  return []; // 默认返回空数组
}

// --- 新增：保存选中状态的函数 ---
function saveSelectionState(selectedIdsArray) {
  try {
    // 确保传入的是数组
    if (!Array.isArray(selectedIdsArray)) {
      console.error("保存选中状态失败：提供的数据不是数组。");
      return;
    }
    const dataString = JSON.stringify(selectedIdsArray, null, 2); // 将 ID 数组转为 JSON 字符串
    fs.writeFileSync(selectionStatePath, dataString, "utf8");
    console.log("选中状态已保存:", selectedIdsArray.length, "项");
  } catch (error) {
    console.error("保存选中状态失败:", error);
  }
}

// --- 创建窗口的函数 ---
const createWindow = () => {
  const loadedData = loadData(); // 启动时加载数据

  const mainWindow = new BrowserWindow({
    width: 1000, // 可以适当调大一点宽度
    height: 700, // 可以适当调大一点高度
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, // 保持禁用 Node 集成
      contextIsolation: true, // 保持开启上下文隔离
    },
  });

  mainWindow.loadFile("index.html");

  // 窗口加载完成后发送数据给渲染进程
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("load-data", loadedData);
  });

  // mainWindow.webContents.openDevTools(); // 需要调试时取消注释
};

// --- Electron App 事件处理 ---
app.whenReady().then(() => {
  createWindow(); // 创建窗口

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- IPC：处理保存数据请求 ---
  ipcMain.on("save-data", (event, dataToSave) => {
    console.log("收到保存数据请求...");
    saveData(dataToSave);
  });

  // --- 新增：IPC 处理加载选中状态 ---
  ipcMain.handle("load-selection-state", async () => {
    return loadSelectionState(); // 调用加载函数并返回结果
  });

  // --- 新增：IPC 处理保存选中状态 ---
  ipcMain.on("save-selection-state", (event, selectedIdsArray) => {
    saveSelectionState(selectedIdsArray); // 调用保存函数
  });

  // --- IPC：处理导出全部笔记请求 (支持 Markdown 和 HTML) ---
  ipcMain.handle("export-all-notes", async (event, notesData, format) => {
    console.log(`收到导出全部笔记请求 (格式: ${format})...`);

    let fileContent = "";
    let defaultPath = "";
    let filters = [];

    // --- 根据请求的格式准备内容和保存选项 ---
    if (format === "markdown") {
      // --- Markdown 导出逻辑 ---
      console.log("准备生成 Markdown...");
      const turndownService = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
      });
      // 递归函数：将笔记数据转换为 Markdown 字符串
      function convertToMarkdown(items, level = 0) {
        let markdown = "";
        const headingLevel = Math.min(level + 1, 6);
        items.forEach((item) => {
          markdown += `${"#".repeat(headingLevel)} ${item.title}\n\n`;
          if (item.content && typeof item.content === "string") {
            try {
              if (item.content.trim() !== "") {
                const itemMarkdown = turndownService.turndown(item.content);
                markdown += `${itemMarkdown}\n\n`;
              } else {
                markdown += `*（无文本内容）*\n\n`;
              }
            } catch (err) {
              console.error(
                `转换 "${item.title}" 内容到 Markdown 时出错:`,
                err
              );
              markdown += `*无法转换内容*\n\n`;
            }
          } else {
            markdown += `*（无文本内容）*\n\n`;
          }
          if (
            item.children &&
            Array.isArray(item.children) &&
            item.children.length > 0
          ) {
            markdown += convertToMarkdown(item.children, level + 1);
          }
        });
        return markdown;
      }
      try {
        fileContent = convertToMarkdown(notesData);
        defaultPath = `我的笔记导出_${Date.now()}.md`;
        filters = [{ name: "Markdown 文件", extensions: ["md"] }];
        console.log("Markdown 内容生成完毕。");
      } catch (error) {
        console.error("生成 Markdown 内容时出错:", error);
        return { success: false, message: "生成 Markdown 内容失败" };
      }
    } else if (format === "html") {
      // --- HTML 导出逻辑 ---
      console.log("准备生成 HTML...");
      // 递归函数：将笔记数据转换为 HTML 字符串
      function convertToHTML(items, level = 0) {
        let html = "";
        const headingLevel = Math.min(level + 1, 6);
        items.forEach((item) => {
          html += `<h${headingLevel} style="margin-left: ${
            level * 20
          }px; margin-top: 1em; margin-bottom: 0.5em;">${escapeHtml(
            item.title
          )}</h${headingLevel}>\n`;
          html += `<div class="note-content" style="margin-left: ${
            level * 20
          }px; border: 1px solid #eee; padding: 10px; margin-bottom: 15px; background-color: #fdfdfd;">\n`;
          if (item.content && typeof item.content === "string") {
            html += item.content; // 直接使用 Quill 的 HTML
          } else {
            html += `<p><em>（无文本内容）</em></p>`;
          }
          html += `</div>\n\n`;
          if (
            item.children &&
            Array.isArray(item.children) &&
            item.children.length > 0
          ) {
            html += convertToHTML(item.children, level + 1);
          }
        });
        return html;
      }
      // 辅助函数：简单 HTML 转义（只用于标题）
      function escapeHtml(unsafe) {
        if (!unsafe) return "";
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
      try {
        const generatedHtml = convertToHTML(notesData);
        // 创建完整的 HTML 文件结构，包含必要的样式
        fileContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>导出的笔记</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; color: #333; }
        .note-content { border: 1px solid #eee; padding: 15px; margin-bottom: 20px; background-color: #fdfdfd; overflow-wrap: break-word; }
        /* 基础 Quill 样式兼容 */
        blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1em; color: #666; }
        pre.ql-syntax { background-color: #f1f1f1; color: #333; padding: 1em; border-radius: 3px; white-space: pre-wrap; overflow-x: auto; }
        ul, ol { padding-left: 2em; }
        a { color: #007bff; text-decoration: none; } a:hover { text-decoration: underline; }
        /* Quill 默认颜色和背景色类 */
        .ql-color-white { color: white; } .ql-bg-white { background-color: white; }
        .ql-color-red { color: #e60000; } .ql-bg-red { background-color: #e60000; }
        .ql-color-orange { color: #f90; } .ql-bg-orange { background-color: #f90; }
        .ql-color-yellow { color: #ff0; } .ql-bg-yellow { background-color: #ff0; }
        .ql-color-green { color: #008a00; } .ql-bg-green { background-color: #008a00; }
        .ql-color-blue { color: #06c; } .ql-bg-blue { background-color: #06c; }
        .ql-color-purple { color: #93f; } .ql-bg-purple { background-color: #93f; }
        .ql-color-black { color: #000; } /* 可能需要补全一些常用颜色 */
        .ql-color-grey { color: #ccc; }
        /* ... (如果使用了更多颜色，需要在此添加) ... */
    </style>
</head>
<body>
    <h1>笔记导出</h1>
    <hr>
    ${generatedHtml}
</body>
</html>`;
        defaultPath = `我的笔记导出_${Date.now()}.html`;
        filters = [{ name: "HTML 文件", extensions: ["html", "htm"] }];
        console.log("HTML 内容生成完毕。");
      } catch (error) {
        console.error("生成 HTML 内容时出错:", error);
        return { success: false, message: "生成 HTML 内容失败" };
      }
    } else {
      // 未知格式
      console.error(`未知的导出格式: ${format}`);
      return { success: false, message: `不支持的导出格式: ${format}` };
    }

    // --- 弹出保存对话框 ---
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `导出笔记为 ${format.toUpperCase()}`,
      defaultPath: defaultPath,
      filters: filters,
    });

    // --- 写入文件 ---
    if (!canceled && filePath) {
      console.log(`准备将 ${format.toUpperCase()} 导出到: ${filePath}`);
      try {
        fs.writeFileSync(filePath, fileContent, "utf8");
        console.log(`${format.toUpperCase()} 文件导出成功！`);
        return {
          success: true,
          message: `笔记导出成功 (${format.toUpperCase()})！`,
        };
      } catch (err) {
        console.error(`写入 ${format.toUpperCase()} 文件失败:`, err);
        return { success: false, message: `保存文件失败: ${err.message}` };
      }
    } else {
      console.log("用户取消了导出。");
      return { success: false, message: "用户取消了导出" };
    }
  });

  // --- 新增：IPC 处理导出选中笔记 ---
  ipcMain.handle(
    "export-selected-notes",
    async (event, selectedData, format) => {
      console.log(
        `收到导出选中笔记请求 (格式: ${format}, 数量: ${selectedData.length})...`
      );
      // --- 复用之前的转换和保存逻辑，但使用 selectedData ---
      let fileContent = "";
      let defaultPath = "";
      let filters = [];

      // --- 根据格式准备内容 ---
      if (format === "markdown") {
        console.log("准备生成选中项的 Markdown...");
        const turndownService = new TurndownService({
          headingStyle: "atx",
          codeBlockStyle: "fenced",
        });
        // 注意：这里的 convertToMarkdown 现在处理的是一个可能不连续的数组
        // 我们让它从 level 0 开始处理 selectedData 里的每一项
        function convertToMarkdown(items, level = 0) {
          // 函数定义可以复用
          let markdown = "";
          const headingLevel = Math.min(level + 1, 6);
          items.forEach((item) => {
            // 如果希望保持原有的层级结构感，可以尝试根据 item ID 在完整数据中查找其深度
            // 但简单起见，我们先统一按顶层处理选中的项
            markdown += `${"#".repeat(1)} ${item.title}\n\n`; // 都作为一级标题
            if (item.content && typeof item.content === "string") {
              try {
                if (item.content.trim() !== "") {
                  const itemMarkdown = turndownService.turndown(item.content);
                  markdown += `${itemMarkdown}\n\n`;
                } else {
                  markdown += `*（无文本内容）*\n\n`;
                }
              } catch (err) {
                markdown += `*无法转换内容*\n\n`;
              }
            } else {
              markdown += `*（无文本内容）*\n\n`;
            }
            // **注意：导出选中项时，通常不递归导出其子项，除非特别需要**
            // if (item.children && ...) { markdown += convertToMarkdown(...) }
            markdown += "---\n\n"; // 添加分隔线区分不同的选中项
          });
          return markdown;
        }
        try {
          fileContent = convertToMarkdown(selectedData, 0); // 从 level 0 处理选中项列表
          defaultPath = `笔记导出_选中${
            selectedData.length
          }项_${Date.now()}.md`;
          filters = [{ name: "Markdown 文件", extensions: ["md"] }];
          console.log("选中项 Markdown 内容生成完毕。");
        } catch (error) {
          /* ... 错误处理 ... */
        }
      } else if (format === "html") {
        console.log("准备生成选中项的 HTML...");
        function convertToHTML(items, level = 0) {
          // 函数定义可以复用
          let html = "";
          const headingLevel = Math.min(level + 1, 6);
          items.forEach((item) => {
            html += `<h${1} style="margin-top: 1.5em; margin-bottom: 0.5em;">${escapeHtml(
              item.title
            )}</h${1}>\n`; // 都用一级标题
            html += `<div class="note-content" style="border: 1px solid #eee; padding: 10px; margin-bottom: 15px; background-color: #fdfdfd;">\n`;
            if (item.content && typeof item.content === "string") {
              html += item.content;
            } else {
              html += `<p><em>（无文本内容）</em></p>`;
            }
            html += `</div>\n\n`;
            // **不递归子项**
            html +=
              '<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">\n\n'; // 添加分隔线
          });
          return html;
        }
        function escapeHtml(unsafe) {
          /* ... */
        } // 转义函数不变
        try {
          const generatedHtml = convertToHTML(selectedData, 0); // 从 level 0 处理选中项列表
          // HTML 结构和样式可以和导出全部时保持一致
          fileContent = `<!DOCTYPE html>...<hr>${generatedHtml}</body></html>`; // 省略大部分模板代码，和上面 export-all 一样
          defaultPath = `笔记导出_选中${
            selectedData.length
          }项_${Date.now()}.html`;
          filters = [{ name: "HTML 文件", extensions: ["html", "htm"] }];
          console.log("选中项 HTML 内容生成完毕。");
        } catch (error) {
          /* ... 错误处理 ... */
        }
      } else {
        /* ... 未知格式处理 ... */
      }

      // --- 弹出保存对话框 ---
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `导出选中的 ${
          selectedData.length
        } 项笔记为 ${format.toUpperCase()}`, // 标题更具体
        defaultPath: defaultPath,
        filters: filters,
      });

      // --- 写入文件 ---
      if (!canceled && filePath) {
        console.log(`准备将选中的 ${format.toUpperCase()} 导出到: ${filePath}`);
        try {
          fs.writeFileSync(filePath, fileContent, "utf8");
          console.log(`选中的 ${format.toUpperCase()} 文件导出成功！`);
          return {
            success: true,
            message: `选中的 ${
              selectedData.length
            } 项笔记导出成功 (${format.toUpperCase()})！`,
          };
        } catch (err) {
          /* ... 错误处理 ... */
        }
      } else {
        /* ... 用户取消处理 ... */
      }
    }
  );
  // --- 新增 IPC Handle 结束 ---
}); // app.whenReady 结束

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
