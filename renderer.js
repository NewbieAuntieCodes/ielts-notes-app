// 等待 HTML 文档加载完毕
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 加载完毕并解析完成"); // 输出日志，方便调试

  let directoryData = [
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

  // 获取输入区域相关的元素
  const sidebar = document.getElementById("sidebar"); // 整个侧边栏
  const contentArea = document.getElementById("content"); // 右侧内容区
  const addTopicArea = document.getElementById("add-topic-area"); // 整个输入区域的 div
  const newTopicInput = document.getElementById("new-topic-input"); // 文字输入框
  const confirmBtn = document.getElementById("confirm-add-topic-btn"); // “添加”按钮
  const cancelBtn = document.getElementById("cancel-add-topic-btn"); // “取消”按钮
  const currentParentIdInput = document.getElementById("current-parent-id"); // 隐藏的 input，用来存父级ID
  const resizeHandle = document.getElementById("resize-handle");
  // const sidebarElement = document.getElementById("sidebar");
  // const contentElement = document.getElementById("content"); // 可能需要调整 content 最小宽度等

  let currentlySelectedItem = null; // 用于跟踪当前被选中的项
  let currentQuillInstance = null;
  let currentEditingTopicId = null; // 跟踪当前正在编辑的话题ID
  let selectedItemIds = new Set();

  // ============================================================
  // == 在这里添加“导出全部笔记”按钮相关的代码 (两个按钮版本) ==
  // ============================================================

  // --- 1. 创建 Markdown 导出按钮 ---
  const exportMdButton = document.createElement("button");
  exportMdButton.textContent = "导出全部 (Markdown)";
  exportMdButton.id = "export-all-md-btn";
  // (样式可以移到 CSS)
  exportMdButton.style.display = "block";
  exportMdButton.style.width = "calc(100% - 30px)";
  exportMdButton.style.margin = "20px 15px 5px 15px"; // 减小按钮间距
  exportMdButton.style.padding = "10px";
  exportMdButton.style.backgroundColor = "#6c757d"; // 灰色系
  exportMdButton.style.color = "white";
  exportMdButton.style.border = "none";
  exportMdButton.style.borderRadius = "4px";
  exportMdButton.style.cursor = "pointer";

  // --- 2. 创建 HTML 导出按钮 ---
  const exportHtmlButton = document.createElement("button");
  exportHtmlButton.textContent = "导出全部 (HTML - 带颜色)";
  exportHtmlButton.id = "export-all-html-btn";
  // (样式可以移到 CSS)
  exportHtmlButton.style.display = "block";
  exportHtmlButton.style.width = "calc(100% - 30px)";
  exportHtmlButton.style.margin = "5px 15px 15px 15px"; // 减小按钮间距
  exportHtmlButton.style.padding = "10px";
  exportHtmlButton.style.backgroundColor = "#007bff"; // 蓝色
  exportHtmlButton.style.color = "white";
  exportHtmlButton.style.border = "none";
  exportHtmlButton.style.borderRadius = "4px";
  exportHtmlButton.style.cursor = "pointer";

  // --- 3. 将按钮添加到侧边栏 ---
  const sidebarContentWrapperForExport = document.getElementById(
    "sidebar-content-wrapper"
  );
  if (sidebarContentWrapperForExport) {
    sidebarContentWrapperForExport.appendChild(exportMdButton); // 添加 Markdown 按钮
    sidebarContentWrapperForExport.appendChild(exportHtmlButton); // 添加 HTML 按钮
  } else {
    // 备用方案
    const sidebarElementForAppendExport = document.getElementById("sidebar");
    if (sidebarElementForAppendExport) {
      sidebarElementForAppendExport.appendChild(exportMdButton);
      sidebarElementForAppendExport.appendChild(exportHtmlButton);
    } else {
      console.error("无法找到侧边栏添加导出按钮！");
    }
  }

  // --- 4. 辅助函数：处理导出逻辑 (避免重复代码) ---
  async function handleExport(format, buttonElement) {
    const originalText = buttonElement.textContent; // 保存原始文字
    console.log(`${format} 导出按钮被点击，准备导出...`);
    buttonElement.textContent = "正在导出...";
    buttonElement.disabled = true;

    try {
      // 调用 preload 函数，传递数据和格式
      // (确保 directoryData 和 showTemporaryStatusMessage 在此作用域可用)
      const result = await window.electronAPI.exportAllNotes(
        directoryData,
        format
      );

      if (result.success) {
        showTemporaryStatusMessage(result.message, "green");
      } else {
        if (result.message !== "用户取消了导出") {
          showTemporaryStatusMessage(`导出失败: ${result.message}`, "red");
        }
      }
    } catch (error) {
      console.error(`调用导出功能 (${format}) 时发生错误:`, error); // 添加格式到日志
      showTemporaryStatusMessage(`导出出错: ${error.message}`, "red");
    } finally {
      buttonElement.textContent = originalText; // 恢复按钮文字
      buttonElement.disabled = false;
    }
  }

  // --- 5. 给两个按钮分别添加点击事件监听器 ---
  exportMdButton.addEventListener("click", () => {
    handleExport("markdown", exportMdButton); // 点击时调用辅助函数，传入格式和按钮本身
  });

  exportHtmlButton.addEventListener("click", () => {
    handleExport("html", exportHtmlButton); // 点击时调用辅助函数，传入格式和按钮本身
  });

  // ============================================================
  // == 导出按钮相关代码结束 ==
  // ============================================================

  // ============================================================
  // == 在这里添加“导出选中笔记”按钮相关的代码 ==
  // ============================================================

  // --- 1. 创建 Markdown 导出选中按钮 ---
  const exportSelectedMdButton = document.createElement("button");
  exportSelectedMdButton.textContent = "导出选中项 (Markdown)";
  exportSelectedMdButton.id = "export-selected-md-btn";
  // (样式可以类似“导出全部”按钮，或自定义)
  exportSelectedMdButton.style.display = "block";
  exportSelectedMdButton.style.width = "calc(100% - 30px)";
  exportSelectedMdButton.style.margin = "10px 15px 5px 15px"; // 调整边距
  exportSelectedMdButton.style.padding = "10px";
  exportSelectedMdButton.style.backgroundColor = "#5a6268"; // 深一点的灰色
  exportSelectedMdButton.style.color = "white";
  exportSelectedMdButton.style.border = "none";
  exportSelectedMdButton.style.borderRadius = "4px";
  exportSelectedMdButton.style.cursor = "pointer";

  // --- 2. 创建 HTML 导出选中按钮 ---
  const exportSelectedHtmlButton = document.createElement("button");
  exportSelectedHtmlButton.textContent = "导出选中项 (HTML - 带颜色)";
  exportSelectedHtmlButton.id = "export-selected-html-btn";
  // (样式可以类似“导出全部”按钮，或自定义)
  exportSelectedHtmlButton.style.display = "block";
  exportSelectedHtmlButton.style.width = "calc(100% - 30px)";
  exportSelectedHtmlButton.style.margin = "5px 15px 15px 15px";
  exportSelectedHtmlButton.style.padding = "10px";
  exportSelectedHtmlButton.style.backgroundColor = "#0069d9"; // 深一点的蓝色
  exportSelectedHtmlButton.style.color = "white";
  exportSelectedHtmlButton.style.border = "none";
  exportSelectedHtmlButton.style.borderRadius = "4px";
  exportSelectedHtmlButton.style.cursor = "pointer";

  // --- 3. 将按钮添加到侧边栏 (添加到之前导出按钮的下方) ---
  // (复用之前的 sidebarContentWrapperForExport 变量，或者重新获取)
  const sidebarWrapperForSelectedExport = document.getElementById(
    "sidebar-content-wrapper"
  );
  if (sidebarWrapperForSelectedExport) {
    sidebarWrapperForSelectedExport.appendChild(exportSelectedMdButton);
    sidebarWrapperForSelectedExport.appendChild(exportSelectedHtmlButton);
  } else {
    /* ... 错误处理 ... */
  }

  // --- 4. 辅助函数：筛选数据 (只获取选中项本身) ---
  function getSelectedNotesData() {
    const selectedData = [];
    for (const itemId of selectedItemIds) {
      const itemData = findItemById(directoryData, itemId);
      if (itemData) {
        // 创建一个副本，避免直接修改原始数据（如果需要的话）
        selectedData.push(JSON.parse(JSON.stringify(itemData)));
        // 如果只想导出基础信息和内容，可以只 push 相关字段：
        // selectedData.push({ title: itemData.title, content: itemData.content });
      }
    }
    return selectedData;
  }

  // --- 5. 给两个“导出选中项”按钮添加点击事件 ---
  async function handleSelectedExport(format, buttonElement) {
    if (selectedItemIds.size === 0) {
      alert("请先在目录中勾选需要导出的笔记！");
      return;
    }

    const selectedData = getSelectedNotesData();
    if (!selectedData || selectedData.length === 0) {
      alert("未能获取选中的笔记数据！");
      return;
    }

    const originalText = buttonElement.textContent;
    console.log(
      `导出选中项 (${format}) 按钮被点击，共 ${selectedItemIds.size} 项...`
    );
    buttonElement.textContent = "正在导出...";
    buttonElement.disabled = true;

    try {
      // 调用新的 preload 函数
      const result = await window.electronAPI.exportSelectedNotes(
        selectedData,
        format
      );

      if (result.success) {
        showTemporaryStatusMessage(result.message, "green");
      } else {
        if (result.message !== "用户取消了导出") {
          showTemporaryStatusMessage(`导出失败: ${result.message}`, "red");
        }
      }
    } catch (error) {
      console.error(`调用导出选中项功能 (${format}) 时发生错误:`, error);
      showTemporaryStatusMessage(`导出出错: ${error.message}`, "red");
    } finally {
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
    }
  }

  exportSelectedMdButton.addEventListener("click", () => {
    handleSelectedExport("markdown", exportSelectedMdButton);
  });

  exportSelectedHtmlButton.addEventListener("click", () => {
    handleSelectedExport("html", exportSelectedHtmlButton);
  });

  // ============================================================
  // == 导出选中笔记按钮相关代码结束 ==
  // ============================================================

  // --- **请用这个完整的代码块替换你 renderer.js 中对应的部分** ---
  window.electronAPI.onLoadData(async (loadedData) => {
    // 确保是 async 函数
    console.log("接收到加载的数据:", loadedData);
    // 检查加载的数据是否有效
    if (Array.isArray(loadedData) && loadedData.length > 0) {
      directoryData = loadedData; // 使用加载的数据
    } else {
      console.log("加载的数据无效或为空，使用默认结构");
      // directoryData 保持为默认值
    }

    // **重建目录树**
    const directoryListElement = document.getElementById("directory-list");
    directoryListElement.innerHTML = ""; // 清空 DOM
    buildTree(directoryListElement, directoryData); // 调用 buildTree 重建
    console.log("目录树已根据加载的数据重建");

    // **初始化 Sortable (如果你需要)**
    const allLists = directoryListElement.querySelectorAll("ul");
    allLists.forEach((ul) => {
      initializeSortable(ul);
    });
    console.log("Sortable 已初始化 (如果需要)");

    // ====================================================
    // == ★★★ 确保加载和应用状态的代码在这里！★★★ ==
    // ====================================================
    try {
      console.log("尝试加载上次的选中状态..."); // 应该看到这个日志
      const loadedIds = await window.electronAPI.loadSelectionState(); // 调用 preload 加载
      selectedItemIds = new Set(loadedIds); // 用加载的 ID 初始化 Set
      console.log("选中状态已加载:", Array.from(selectedItemIds)); // 应该看到这个日志和加载的 ID
      applySelectionStateToUI(); // 调用应用状态到界面的函数 (这个函数内部也有日志)
    } catch (error) {
      console.error("加载选中状态时出错:", error);
    }
    // ====================================================
    // == 加载和应用状态代码结束 ==
    // ====================================================

    // 在所有数据加载和状态应用完成后，再显示初始内容和清除选中高亮
    displayContent(null);
    updateSelection(null);
  });
  // --- onLoadData 监听器结束 ---

  // --- 最终版本 displayContent 函数 (调用递归函数显示后代) ---
  function displayContent(topicId) {
    contentArea.innerHTML = ""; // 清空内容区域
    let titleToShow = "请选择一个话题";
    let currentItemData = null;

    // --- 销毁旧的 Quill 实例 ---
    if (currentQuillInstance) {
      const editorContainer = document.getElementById("editor-container");
      if (editorContainer) editorContainer.innerHTML = "";
      const toolbarContainer = document.getElementById("toolbar-container");
      if (toolbarContainer) toolbarContainer.innerHTML = "";
      currentQuillInstance = null;
    }
    currentEditingTopicId = null;

    // 1. 根据 ID 查找数据
    if (topicId) {
      currentItemData = findItemById(directoryData, topicId);
    }

    // 2. 如果找到了数据项
    if (currentItemData) {
      titleToShow = currentItemData.title;
      currentEditingTopicId = topicId;

      // 确保 content 是字符串
      if (typeof currentItemData.content !== "string") {
        currentItemData.content = "";
      }

      // --- 渲染父话题标题 (包含点击编辑功能) ---
      const titleElement = document.createElement("h1");
      titleElement.textContent = titleToShow;
      titleElement.style.display = "inline-block";
      titleElement.style.cursor = "pointer";
      titleElement.title = "点击可修改标题";
      if (!currentItemData.isStatic) {
        titleElement.addEventListener("click", () => {
          switchToTitleEditMode(titleElement, topicId);
        });
      } else {
        titleElement.style.cursor = "default";
        titleElement.title = "";
      }
      contentArea.appendChild(titleElement); // 添加标题

      // --- 创建编辑器容器和工具栏容器 ---
      let toolbarContainer = document.getElementById("toolbar-container");
      if (!toolbarContainer) {
        toolbarContainer = document.createElement("div");
        toolbarContainer.id = "toolbar-container";
        contentArea.appendChild(toolbarContainer);
      }
      let editorContainer = document.getElementById("editor-container");
      if (!editorContainer) {
        editorContainer = document.createElement("div");
        editorContainer.id = "editor-container";
        editorContainer.style.height = "auto"; // 自动高度
        editorContainer.style.minHeight = "150px"; // 最小高度
        editorContainer.style.border = "1px solid #ccc";
        contentArea.appendChild(editorContainer);
      } else {
        editorContainer.innerHTML = ""; // 清空以备重用
      }

      // --- 初始化 Quill 或显示静态信息 ---
      if (!currentItemData.isStatic) {
        // 初始化 Quill
        const options = {
          modules: {
            toolbar: [
              // 这里是你定义的工具栏配置
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ indent: "-1" }, { indent: "+1" }],
              ["link", "image", "blockquote", "code-block"],
              ["clean"],
            ],
          },
          placeholder: "在这里输入你的笔记...",
          theme: "snow",
        };
        currentQuillInstance = new Quill("#editor-container", options);
        // 加载内容
        if (currentItemData.content) {
          currentQuillInstance.clipboard.dangerouslyPasteHTML(
            currentItemData.content
          );
        }

        // 添加保存按钮
        const saveButton = document.createElement("button");
        saveButton.id = "save-content-button";
        saveButton.textContent = "保存笔记 (Ctrl+S)";
        // (按钮样式和事件监听)
        saveButton.style.marginTop = "15px";
        saveButton.style.padding = "10px 20px";
        saveButton.style.backgroundColor = "#28a745";
        saveButton.style.color = "white";
        saveButton.style.border = "none";
        saveButton.style.borderRadius = "4px";
        saveButton.style.cursor = "pointer";
        saveButton.style.fontSize = "14px";
        saveButton.addEventListener("click", () => {
          saveCurrentContent(currentEditingTopicId);
        });
        contentArea.appendChild(saveButton); // 添加保存按钮
      } else {
        // 静态项显示提示
        editorContainer.innerHTML = `<p style="color: #666; padding: 15px;">这是 "${titleToShow}" 的概览视图。</p>`;
      }

      // --- 渲染所有后代话题内容 ---
      // 检查是否有子话题
      if (
        currentItemData &&
        currentItemData.children &&
        Array.isArray(currentItemData.children) &&
        currentItemData.children.length > 0
      ) {
        // 创建包裹所有子孙后代内容的容器
        const childContentArea = document.createElement("div");
        childContentArea.id = "child-content-display";
        childContentArea.style.marginTop = "30px";
        childContentArea.style.paddingTop = "20px";
        childContentArea.style.borderTop = "2px dashed #ccc";

        // 遍历 *直接* 子项，并为每个子项启动递归渲染
        currentItemData.children.forEach((directChild) => {
          // 调用递归函数，从 level 0 开始
          renderDescendantPreview(directChild, 0, childContentArea);
        });

        // 将渲染好的子孙内容区域添加到主内容区
        contentArea.appendChild(childContentArea);
      }
    } else {
      // 未选中项或未找到数据，显示默认信息
      contentArea.innerHTML = `<h1>请选择一个话题</h1><p style="color: #666;">请在左侧选择或添加一个话题来查看或编辑笔记。</p>`;
      currentEditingTopicId = null;
    }
  } // displayContent 函数结束

  // --- 辅助函数：递归渲染所有后代话题预览 ---
  function renderDescendantPreview(item, level, containerElement) {
    // 创建当前项的包裹元素，并根据层级添加缩进
    const wrapper = document.createElement("div");
    wrapper.classList.add("descendant-item-preview");
    wrapper.style.marginLeft = `${level * 25}px`; // 每层缩进
    wrapper.style.marginBottom = "15px";

    // 显示标题
    const titleTag = `h${Math.min(level + 3, 6)}`; // h3, h4...
    const titleElement = document.createElement(titleTag);
    titleElement.textContent = item.title;
    titleElement.style.marginBottom = "5px";
    titleElement.style.color = "#555";
    wrapper.appendChild(titleElement);

    // 显示内容预览 (只读 HTML)
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("descendant-content-readonly");
    if (item && typeof item.content === "string") {
      contentDiv.innerHTML = item.content;
    } else {
      contentDiv.innerHTML = "<p><em>(无内容或格式错误)</em></p>";
    }
    // 添加基础样式
    contentDiv.style.padding = "8px";
    contentDiv.style.border = "1px solid #f0f0f0";
    contentDiv.style.backgroundColor = "#fafafa";
    contentDiv.style.fontSize = "0.9em";
    contentDiv.setAttribute("contenteditable", "false");
    wrapper.appendChild(contentDiv);

    // 添加到父容器
    containerElement.appendChild(wrapper);

    // 递归调用
    if (
      item.children &&
      Array.isArray(item.children) &&
      item.children.length > 0
    ) {
      item.children.forEach((child) => {
        renderDescendantPreview(child, level + 1, containerElement);
      });
    }
  } // renderDescendantPreview 函数结束

  // --- 更新选中项高亮的函数 ---
  function updateSelection(selectedElement) {
    // 移除之前选中项的高亮类 'selected-item'
    if (currentlySelectedItem) {
      currentlySelectedItem.classList.remove("selected-item");
    }
    // 给新选中的项添加高亮类 'selected-item'
    if (selectedElement) {
      selectedElement.classList.add("selected-item");
      currentlySelectedItem = selectedElement; // 记下当前选中的项
    } else {
      currentlySelectedItem = null; // 如果没有选中项，也记下来
    }
  }

  // --- 修改后的 saveCurrentContent 函数，用于从 Quill 获取内容 ---
  function saveCurrentContent(topicId) {
    // 检查 topicId 是否就是当前正在编辑的 ID，以及 Quill 实例是否存在
    if (
      !topicId ||
      topicId !== currentEditingTopicId ||
      !currentQuillInstance
    ) {
      console.log("无法保存：没有选中有效话题或编辑器未初始化。");
      // 可以考虑给用户提示
      if (topicId && findItemById(directoryData, topicId)?.isStatic) {
        showTemporaryStatusMessage("静态项无法保存内容。", "orange");
      } else if (!currentQuillInstance && topicId) {
        showTemporaryStatusMessage("编辑器未加载，无法保存。", "red");
      }
      return; // 退出函数
    }

    const currentTopicData = findItemById(directoryData, topicId);

    // 确保找到了数据对象，并且不是静态项
    if (currentTopicData && !currentTopicData.isStatic) {
      // 从 Quill 编辑器获取 HTML 内容
      const newContentHTML = currentQuillInstance.root.innerHTML;

      // 或者，获取 Delta 格式 (更推荐，但处理起来稍复杂)
      // const newContentDelta = currentQuillInstance.getContents();
      // // 如果使用 Delta，需要将 Delta 序列化为 JSON 字符串保存
      // const contentToSave = JSON.stringify(newContentDelta);

      // --- 我们先用 HTML 格式 ---
      const contentToSave = newContentHTML;

      // 检查内容是否有变化（与内存中的数据比较）
      if (currentTopicData.content !== contentToSave) {
        currentTopicData.content = contentToSave; // 更新内存中的数据
        window.electronAPI.saveData(directoryData); // 触发保存到文件
        console.log(`内容已保存 (HTML 格式) (Topic: ${topicId})`);
        showTemporaryStatusMessage("内容已保存!", "green");
      } else {
        console.log("内容无变化，未保存。");
        showTemporaryStatusMessage("内容无变化。", "grey");
      }
    } else {
      console.log("无法保存：未找到数据或为静态项。");
    }
  }

  // --- 封装一个函数：用来隐藏输入区域并清空内容 ---
  function hideInputArea() {
    addTopicArea.classList.add("hidden"); // 给输入区域 div 添加 'hidden' 类来隐藏它
    newTopicInput.value = ""; // 清空输入框的内容
    currentParentIdInput.value = ""; // 清空隐藏 input 里存的父级 ID
  }

  // --- 修改后的 buildTree 函数，移除了内部的复选框监听器 ---
  function buildTree(parentElement, items) {
    const listElement = document.createElement("ul");

    if (parentElement.id !== "directory-list") {
      initializeSortable(listElement);
    }

    items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.id = item.id;
      listItem.dataset.id = item.id; // 添加 data-id

      if (item.isStatic) {
        listItem.classList.add("static-item");
      } else {
        listItem.classList.add("topic-item");
      }

      // --- 创建并添加复选框 ---
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.classList.add("item-checkbox");
      checkbox.dataset.itemId = item.id;
      checkbox.style.marginRight = "5px";
      // ！！！ 移除这里的 click 事件监听器 ！！！
      // checkbox.addEventListener('click', (event) => {
      //     event.stopPropagation();
      //     console.log(`Checkbox for ${item.id} clicked, checked: ${event.target.checked}`);
      // });
      listItem.appendChild(checkbox);
      // --- 复选框代码结束 ---

      const textSpan = document.createElement("span");
      textSpan.textContent = item.title;
      if (!item.isStatic) {
        textSpan.classList.add("topic-text");
      }
      listItem.appendChild(textSpan);

      // 添加 "+" 按钮 (建议移到外部监听)
      if (!item.isStatic || item.id.startsWith("part1-")) {
        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        addBtn.classList.add("add-topic-btn");
        addBtn.dataset.parentId = item.id;
        listItem.appendChild(addBtn);
      }

      // 添加 "X" 按钮 (建议移到外部监听)
      if (!item.isStatic) {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "X";
        deleteBtn.classList.add("delete-topic-btn");
        deleteBtn.dataset.itemId = item.id;
        listItem.appendChild(deleteBtn);
      }

      listElement.appendChild(listItem);

      // 递归调用 (不变)
      if (item.children && item.children.length > 0) {
        buildTree(listItem, item.children);
      }
    });

    parentElement.appendChild(listElement);
  } // buildTree 函数结束// buildTree 函数结束

  // renderer.js (添加辅助函数)
  function findItemById(items, id) {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findParentAndItemById(items, id, parent = null) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.id === id) return { parent: parent, item: item, index: i };
      if (item.children) {
        const found = findParentAndItemById(item.children, id, item);
        if (found) return found;
      }
    }
    return null;
  }

  // renderer.js (添加新函数)
  function handleDeleteItem(itemId) {
    console.log(`尝试删除 ID: ${itemId}`);
    // 1. 从数据结构中找到并删除项
    const findResult = findParentAndItemById(directoryData, itemId);

    if (findResult && findResult.parent && findResult.parent.children) {
      // 从父级的 children 数组中移除
      findResult.parent.children.splice(findResult.index, 1);

      // 2. 从 DOM 中移除对应的 li
      const listItemElement = document.getElementById(itemId);
      if (listItemElement) {
        // 如果删除的是当前选中的项，取消选中
        if (listItemElement === currentlySelectedItem) {
          displayContent(null);
          updateSelection(null);
        }
        listItemElement.remove();
        console.log(`已从数据和 DOM 中删除 ID: ${itemId}`);

        // 3. 触发保存
        window.electronAPI.saveData(directoryData);
      } else {
        console.error(`删除数据后，未能找到对应的 DOM 元素 ID: ${itemId}`);
        // 可能需要考虑数据和DOM不同步的情况，可以强制重绘 buildTree(document.getElementById('directory-list'), directoryData);
      }
    } else if (findResult && !findResult.parent) {
      // 可能是尝试删除顶级项 (Part 1/2/3) - 应该阻止或忽略
      console.warn(`尝试删除顶级项 ID: ${itemId}，已忽略`);
    } else {
      console.error(`删除失败：在数据结构中找不到项或其父项 ID: ${itemId}`);
    }
  }

  // --- 初始化 SortableJS 的函数 ---
  function initializeSortable(ulElement) {
    if (!ulElement) return; // 安全检查

    new Sortable(ulElement, {
      group: "shared-topics", // **重要：设置组名，允许在相同组的列表间拖拽**
      animation: 150, // 拖拽动画效果
      fallbackOnBody: true, // 解决可能的渲染问题
      swapThreshold: 0.65, // 交换阈值
      filter: ".static-item", // **重要：禁止拖拽带有 static-item 类的项**
      preventOnFilter: true, // 阻止对过滤元素的拖拽尝试
      onEnd: (evt) => {
        // **拖拽结束后的回调函数**
        handleDragEnd(evt); // 调用我们处理数据更新的函数
      },
    });
  }

  // --- 处理拖拽结束的函数 (更新数据结构) ---
  function handleDragEnd(evt) {
    const itemElement = evt.item; // 被拖拽的 <li> 元素
    const toListElement = evt.to; // 目标 <ul> 元素
    const fromListElement = evt.from; // 来源 <ul> 元素
    const oldIndex = evt.oldIndex; // 在旧列表中的索引
    const newIndex = evt.newIndex; // 在新列表中的索引

    const itemId = itemElement.id; // 被拖拽项的 ID
    // 获取目标列表的父 li 的 ID (如果目标是顶级列表，则可能没有)
    const newParentLi = toListElement.closest("li");
    const newParentId = newParentLi ? newParentLi.id : null; // 如果直接拖到根目录，父ID可能是null或特定的根ID

    // 获取来源列表的父 li 的 ID
    const oldParentLi = fromListElement.closest("li");
    const oldParentId = oldParentLi ? oldParentLi.id : null;

    console.log(
      `拖拽结束: Item ID=<span class="math-inline">\{itemId\}, From Parent ID\=</span>{oldParentId} (Index <span class="math-inline">\{oldIndex\}\), To Parent ID\=</span>{newParentId} (Index ${newIndex})`
    );

    // 1. 从 directoryData 中找到被拖拽的项的数据和它的旧父级
    const findOldResult = findParentAndItemById(directoryData, itemId);

    if (!findOldResult || !findOldResult.item) {
      console.error("拖拽错误：无法在数据中找到被拖拽的项:", itemId);
      // 可能需要强制刷新界面或给出错误提示
      return;
    }
    const itemData = findOldResult.item; // 拖拽项的数据
    const oldParentChildren = findOldResult.parent
      ? findOldResult.parent.children
      : directoryData; // 旧父级的 children 数组或根数组

    // 2. 从旧父级的 children 数组中移除该项
    oldParentChildren.splice(oldIndex, 1);

    // 3. 找到新父级的数据对象
    let newParentChildren;
    if (newParentId) {
      // 如果拖到了某个父项下
      const newParentItem = findItemById(directoryData, newParentId);
      if (!newParentItem) {
        console.error("拖拽错误：无法在数据中找到新的父级项:", newParentId);
        // 需要考虑如何撤销或处理这种情况，可能需要把项放回原处？
        // 暂时先放回原处的数据结构
        oldParentChildren.splice(oldIndex, 0, itemData);
        // 可能还需要更新 DOM？或者提示错误？
        return;
      }
      if (!newParentItem.children) newParentItem.children = []; // 确保有 children 数组
      newParentChildren = newParentItem.children;
    } else {
      // 如果是拖到了根层级 (直接在 Part 1/2/3 下，或在顶级目录) - 这里需要根据你的结构调整
      // 假设根目录由 directoryData 直接表示，但我们只想拖到 Part 1 下的题型下
      // 需要判断 toListElement 是否是 题型下的 ul
      const questionTypeLi = toListElement.closest('li[id^="part1-"]'); // 找到题型 li
      if (questionTypeLi) {
        const questionTypeItem = findItemById(directoryData, questionTypeLi.id);
        if (questionTypeItem) {
          if (!questionTypeItem.children) questionTypeItem.children = [];
          newParentChildren = questionTypeItem.children;
        } else {
          console.error(
            "拖拽错误：无法在数据中找到目标题型项:",
            questionTypeLi.id
          );
          return;
        }
      } else {
        console.error("拖拽错误：不允许直接拖拽到根目录或 Part 1/2/3 下");
        // 把数据放回去
        oldParentChildren.splice(oldIndex, 0, itemData);
        // 可能需要DOM操作复原或重绘
        return;
      }
    }

    // 4. 将项插入到新父级的 children 数组中的新位置
    newParentChildren.splice(newIndex, 0, itemData);

    // 5. 触发保存
    console.log("数据结构已更新，准备保存...");
    window.electronAPI.saveData(directoryData);

    // SortableJS 已经更新了 DOM，我们只需要更新数据并保存
  }

  // renderer.js (请将这个函数添加到其他函数定义的地方)

  // --- 切换到编辑模式 ---
  function switchToEditMode(spanElement, itemId) {
    console.log(`切换到编辑模式 for ID: ${itemId}`); // 添加日志确认函数被调用
    const currentTitle = spanElement.textContent;
    const parentLi = spanElement.closest("li"); // 获取包含 span 的 li
    if (!parentLi) {
      console.error("无法找到父级 li 元素");
      return;
    }

    // 创建 input 元素
    const inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.value = currentTitle;
    inputElement.classList.add("rename-input"); // 添加样式类
    // 尝试让输入框宽度自适应，减去按钮大致宽度，可调整
    inputElement.style.width = "calc(100% - 50px)";

    // 替换 span 为 input
    spanElement.replaceWith(inputElement);
    inputElement.focus(); // 自动聚焦
    inputElement.select(); // 选中文字方便修改
    console.log("输入框已创建并替换了 span");

    // --- 处理编辑完成或取消的函数 ---
    function finishEditing(shouldSave) {
      console.log(`完成编辑, shouldSave: ${shouldSave}`);
      const newTitle = inputElement.value.trim(); // 获取输入框最终值并去除首尾空格

      // **重要：先恢复显示 span，再处理数据和事件移除**
      // 这样即使用户快速操作，界面也不会奇怪
      inputElement.replaceWith(spanElement);

      // **重要：移除事件监听器，防止内存泄漏**
      inputElement.removeEventListener("blur", handleBlur);
      inputElement.removeEventListener("keydown", handleKeyDown);
      console.log("输入框的事件监听器已移除");

      // 判断是否需要保存
      if (shouldSave && newTitle && newTitle !== currentTitle) {
        console.log(`准备保存新标题: "${newTitle}" for ID: ${itemId}`);
        // 只有当需要保存、新标题有效(不为空)且与旧标题不同时才更新
        spanElement.textContent = newTitle; // 更新界面上的文本

        // 更新 directoryData 中的数据
        const itemToUpdate = findItemById(directoryData, itemId); // 需要 findItemById 函数
        if (itemToUpdate) {
          itemToUpdate.title = newTitle;
          console.log(`数据结构已更新: ID ${itemId} 重命名为 "${newTitle}"`);
          // 触发保存到文件
          window.electronAPI.saveData(directoryData); // 需要 window.electronAPI 和 saveData
        } else {
          console.error(`重命名失败: 在数据结构中找不到 ID ${itemId}`);
          spanElement.textContent = currentTitle; // 恢复界面为旧标题
          alert("重命名失败，未找到数据！"); // 给用户提示
        }
      } else {
        // 如果不保存(按Esc) 或 标题无效/未改变，确保界面恢复为原始标题
        console.log("取消编辑或标题未改变，恢复原标题");
        spanElement.textContent = currentTitle;
      }
    }

    // --- 事件处理函数 (需要定义在 switchToEditMode 内部，以便访问 inputElement) ---
    const handleBlur = () => {
      console.log("输入框失去焦点 (blur)");
      // 稍微延迟处理，避免与 Enter 键冲突或快速点击导致的问题
      setTimeout(() => finishEditing(true), 100); // 失去焦点时默认保存
    };
    const handleKeyDown = (event) => {
      console.log(`按键事件: ${event.key}`);
      if (event.key === "Enter") {
        event.preventDefault(); // 阻止可能的默认行为（如表单提交）
        finishEditing(true); // 按 Enter 保存
      } else if (event.key === "Escape") {
        finishEditing(false); // 按 Esc 取消
      }
    };

    // **重要：添加事件监听器到 inputElement**
    inputElement.addEventListener("blur", handleBlur);
    inputElement.addEventListener("keydown", handleKeyDown);
    console.log("已为输入框添加 blur 和 keydown 监听器");
  }

  // --- 新增：处理内容区标题点击编辑的函数 ---
  function switchToTitleEditMode(titleElement, topicId) {
    const currentTitle = titleElement.textContent;
    console.log(`切换到标题编辑模式 for ID: ${topicId}`);

    // 创建 input 元素
    const inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.value = currentTitle;
    inputElement.classList.add("title-rename-input"); // 添加样式类 (可选)
    inputElement.style.fontSize = "1.5em"; // 让输入框大小接近 h1 (可调整)
    inputElement.style.fontWeight = "bold";
    inputElement.style.border = "1px solid #007bff"; // 蓝色边框提示
    inputElement.style.padding = "2px 5px";

    // 替换 h1 为 input
    titleElement.replaceWith(inputElement);
    inputElement.focus(); // 自动聚焦
    inputElement.select(); // 选中文字方便修改

    // --- 处理编辑完成或取消的函数 (定义在内部以便访问变量) ---
    function finishTitleEditing(shouldSave) {
      const newTitle = inputElement.value.trim();

      // 恢复显示 h1 (先恢复 DOM 结构)
      inputElement.replaceWith(titleElement); // 用原来的 h1 元素替换回去

      // 移除事件监听器，防止内存泄漏
      inputElement.removeEventListener("blur", handleBlur);
      inputElement.removeEventListener("keydown", handleKeyDown);
      console.log("标题输入框的事件监听器已移除");

      // 判断是否需要保存，且内容有效且有变化
      if (shouldSave && newTitle && newTitle !== currentTitle) {
        console.log(`准备保存新标题: "${newTitle}" for ID: ${topicId}`);

        // 1. 更新界面上的 h1 文本
        titleElement.textContent = newTitle;

        // 2. 更新 directoryData 中的数据
        const itemToUpdate = findItemById(directoryData, topicId);
        if (itemToUpdate) {
          itemToUpdate.title = newTitle;
          console.log(`数据结构已更新: ID ${topicId} 重命名为 "${newTitle}"`);

          // 3. 更新左侧边栏对应的 li 中的文本
          const sidebarLi = document.getElementById(topicId);
          if (sidebarLi) {
            // 查找 li 中的 .topic-text span 来更新
            const sidebarSpan = sidebarLi.querySelector(".topic-text");
            if (sidebarSpan) {
              sidebarSpan.textContent = newTitle;
              console.log(`侧边栏项 ${topicId} 的文本已更新`);
            } else {
              console.warn(
                `未能找到侧边栏项 ${topicId} 内的 .topic-text 用于更新`
              );
              // 作为备用，可以尝试更新 li 的第一个文本节点，但这可能不准确
            }
          } else {
            console.warn(`未能找到侧边栏项 ${topicId} 用于更新文本`);
          }

          // 4. 触发保存到文件
          window.electronAPI.saveData(directoryData);
          showTemporaryStatusMessage("标题已更新!", "green");
        } else {
          console.error(`重命名失败: 在数据结构中找不到 ID ${topicId}`);
          titleElement.textContent = currentTitle; // 恢复界面为旧标题
          alert("重命名失败，未找到数据！");
        }
      } else {
        // 如果不保存(按Esc) 或 标题无效/未改变，确保界面恢复为原始标题
        console.log("取消标题编辑或标题未改变");
        titleElement.textContent = currentTitle; // 确保 h1 显示的是正确的（旧的或未变的）标题
      }
    }

    // --- 输入框事件处理函数 ---
    const handleBlur = () => {
      // 稍微延迟处理，避免与 Enter/Esc 键冲突
      setTimeout(() => finishTitleEditing(true), 150); // 失去焦点时默认保存
    };
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finishTitleEditing(true); // 按 Enter 保存
      } else if (event.key === "Escape") {
        finishTitleEditing(false); // 按 Esc 取消
      }
    };

    // --- 添加事件监听器到 inputElement ---
    inputElement.addEventListener("blur", handleBlur);
    inputElement.addEventListener("keydown", handleKeyDown);
  } // switchToTitleEditMode 函数结束

  // (findItemById 和 findParentAndItemById 函数需要保持不变)

  // **处理鼠标移动的函数**
  function handleMouseMove(e) {
    if (!isResizing) return;

    console.log("Mouse Move Firing!"); // **增加日志**

    const currentX = e.clientX;
    const dx = currentX - startX;
    let newWidth = startWidth + dx;

    const minWidth = parseInt(getComputedStyle(sidebar).minWidth, 10) || 150;
    const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth, 10) || 600;

    if (newWidth < minWidth) newWidth = minWidth;
    else if (newWidth > maxWidth) newWidth = maxWidth;

    console.log(`  -> dx: ${dx}, newWidth: ${newWidth}`); // **增加日志**

    // **尝试修改 flex-basis**
    sidebar.style.flexBasis = `${newWidth}px`; // **<-- 修改这里**
    console.log(`  -> Applied style.flexBasis: ${sidebar.style.flexBasis}`); // **增加日志**

    // **注释掉修改 width 的代码**
    // sidebar.style.width = `${newWidth}px`;
    // console.log(`  -> Applied style.width: ${sidebar.style.width}`);
  }

  // **处理鼠标松开的函数**
  function handleMouseUp() {
    console.log("Mouse Up Firing!"); // **增加日志**

    if (isResizing) {
      console.log("停止调整大小 (isResizing = true)");
      isResizing = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    } else {
      console.log("Mouse Up Fired, but not resizing."); // **增加日志**
    }
  }

  // --- 新增：辅助函数，用于显示短暂的状态消息 ---
  function showTemporaryStatusMessage(
    message,
    color = "green",
    duration = 2000
  ) {
    // 尝试在 contentArea 底部添加或找到一个状态栏元素
    let statusBar = document.getElementById("save-status-bar");
    if (!statusBar) {
      statusBar = document.createElement("div");
      statusBar.id = "save-status-bar";
      // 基本样式，可以移到 CSS
      statusBar.style.position = "fixed";
      statusBar.style.bottom = "10px";
      statusBar.style.right = "20px";
      statusBar.style.padding = "5px 10px";
      statusBar.style.borderRadius = "3px";
      statusBar.style.fontSize = "12px";
      statusBar.style.zIndex = "1000"; // 确保在顶层
      statusBar.style.opacity = "0"; // 初始透明
      statusBar.style.transition = "opacity 0.5s ease-in-out"; // 淡入淡出效果
      document.body.appendChild(statusBar); // 添加到 body 而不是 contentArea，避免滚动问题
    }

    statusBar.textContent = message;
    statusBar.style.backgroundColor =
      color === "green" ? "#28a745" : color === "red" ? "#dc3545" : "#ffc107";
    statusBar.style.color = "white";
    statusBar.style.opacity = "1"; // 淡入

    // 清除之前的定时器（如果存在），防止消息快速切换时行为混乱
    if (statusBar.timeoutId) {
      clearTimeout(statusBar.timeoutId);
    }

    // 设置定时器，在指定时间后淡出并清除文本
    statusBar.timeoutId = setTimeout(() => {
      statusBar.style.opacity = "0";
      // 等待淡出动画结束后再清除文本（可选）
      // setTimeout(() => { statusBar.textContent = ''; }, 500);
    }, duration);
  }

  // --- 新增：应用加载到的选中状态到界面复选框 ---
  // (请将这个函数添加到 renderer.js 的其他函数定义旁边)
  function applySelectionStateToUI() {
    console.log("开始应用选中状态到 UI..."); // 日志：开始应用
    // 确保在 DOM 完全构建后再查找复选框
    const allCheckboxes = sidebar.querySelectorAll(".item-checkbox");
    if (!allCheckboxes || allCheckboxes.length === 0) {
      console.warn("应用状态时未找到任何复选框元素。");
      return;
    }

    let appliedCount = 0;
    allCheckboxes.forEach((checkbox) => {
      const itemId = checkbox.dataset.itemId;
      // 检查 selectedItemIds 是否已定义并且是一个 Set
      if (selectedItemIds && typeof selectedItemIds.has === "function") {
        if (selectedItemIds.has(itemId)) {
          // 检查 ID 是否在加载的集合中
          checkbox.checked = true; // 如果在，就勾选
          appliedCount++;
        } else {
          checkbox.checked = false; // 如果不在，就取消勾选
        }
      } else {
        // 如果 selectedItemIds 无效，则确保所有框都未选中
        checkbox.checked = false;
        console.warn("selectedItemIds 无效，无法应用状态。");
      }
    });
    console.log(`UI 选中状态应用完毕，共 ${appliedCount} 项被选中。`); // 日志：应用结束
  } // applySelectionStateToUI 函数结束

  let isResizing = false;
  let startX, startWidth;

  resizeHandle.addEventListener("mousedown", (e) => {
    // 检查 resizeHandle 是否成功获取
    if (!resizeHandle) {
      console.error("错误: resizeHandle 元素未找到!");
      return;
    }
    // 检查 sidebar 是否成功获取
    if (!sidebar) {
      console.error("错误: sidebar 元素未找到!");
      return;
    }

    isResizing = true;
    startX = e.clientX; // 记录鼠标按下的初始 X 坐标
    startWidth = sidebar.offsetWidth; // 记录侧边栏按下的初始宽度
    console.log("开始调整大小...");

    // **在 document 上添加 mousemove 和 mouseup 监听器**
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // 阻止拖动时选中文本
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize"; // 设置全局光标
  });

  // --- 给所有的 "+" 按钮添加点击事件 ---
  const addTopicButtons = document.querySelectorAll(".add-topic-btn"); // 找到所有的 "+" 按钮

  addTopicButtons.forEach((button) => {
    // 遍历每个按钮
    button.addEventListener("click", (event) => {
      // 给按钮添加点击监听
      const parentId = event.target.dataset.parentId; // 获取按钮上存的父级 ID
      if (!parentId) return; // 如果没有父级 ID，就什么也不做

      // **重要：点击 "+" 按钮时，不再直接添加话题**
      // 1. 把父级 ID 存到隐藏的 input 里
      currentParentIdInput.value = parentId;
      // 2. 移除输入区域的 'hidden' 类，让它显示出来
      addTopicArea.classList.remove("hidden");
      // 3. 让光标自动进入输入框，方便用户输入
      newTopicInput.focus();
      console.log(`准备在 ${parentId} 下添加话题，已显示输入框`);
    });
  });

  // --- 给输入区域里的 "添加" 按钮添加点击事件 ---
  confirmBtn.addEventListener("click", () => {
    const parentId = currentParentIdInput.value;
    const topicName = newTopicInput.value;

    if (parentId && topicName && topicName.trim() !== "") {
      const parentItem = findItemById(directoryData, parentId);

      if (parentItem) {
        if (!parentItem.children) {
          parentItem.children = [];
        }
        const newTopicId =
          "topic-" +
          Date.now() +
          "-" +
          Math.random().toString(36).substring(2, 7);

        // --- 主要修改在这里：content 初始化为空字符串 ---
        const newTopicData = {
          id: newTopicId,
          title: topicName.trim(),
          isStatic: false,
          content: "", // <--- 修改这里，初始化为空字符串
          children: [],
        };
        // --- 修改结束 ---

        parentItem.children.push(newTopicData);
        console.log(`数据已添加到 ${parentId} 的 children`);

        const parentLiElement = document.getElementById(parentId);
        if (parentLiElement) {
          let parentUl = parentLiElement.querySelector("ul");
          if (!parentUl) {
            parentUl = document.createElement("ul");
            parentLiElement.appendChild(parentUl);
            initializeSortable(parentUl); // 确保新 ul 也可排序
            console.log(`为 ${parentId} 创建了新的子列表 ul`);
          }

          const listItem = document.createElement("li");
          listItem.id = newTopicData.id;
          listItem.classList.add("topic-item");

          const textSpan = document.createElement("span");
          textSpan.textContent = newTopicData.title;
          textSpan.classList.add("topic-text");

          const addBtn = document.createElement("button");
          addBtn.textContent = "+";
          addBtn.classList.add("add-topic-btn");
          addBtn.dataset.parentId = newTopicId;
          addBtn.addEventListener("click", (event) => {
            const clickedParentId = event.target.dataset.parentId;
            if (!clickedParentId) return;
            currentParentIdInput.value = clickedParentId;
            addTopicArea.classList.remove("hidden");
            newTopicInput.focus();
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.textContent = "X";
          deleteBtn.classList.add("delete-topic-btn");
          deleteBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            handleDeleteItem(newTopicId);
          });

          listItem.appendChild(textSpan);
          listItem.appendChild(addBtn);
          listItem.appendChild(deleteBtn);
          parentUl.appendChild(listItem);

          console.log(`新话题 "${topicName.trim()}" 的 li 元素已添加到 DOM`);
        } else {
          console.error(`添加到数据后，未能找到父级 DOM 元素 ID: ${parentId}`);
        }

        hideInputArea();
        window.electronAPI.saveData(directoryData); // 保存更新后的数据
      } else {
        console.error(`添加失败：在数据结构中找不到父项 ID "${parentId}"`);
        hideInputArea();
      }
    } else {
      console.log("父级 ID 丢失或话题名称为空。");
      if (parentId && (!topicName || topicName.trim() === "")) {
        alert("请输入话题名称！");
        newTopicInput.focus();
      } else {
        hideInputArea();
      }
    }
  });

  // --- 修改后的 Ctrl+S 处理逻辑 (用于单一文本区域) ---
  document.addEventListener("keydown", (event) => {
    // 检查是否按下了 Ctrl (或 Cmd 在 Mac 上) + S
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault(); // 阻止浏览器默认的保存页面行为

      console.log("Ctrl+S 按下，尝试保存当前内容...");

      // 1. 找到当前选中的话题 ID
      const currentTopicId = currentlySelectedItem
        ? currentlySelectedItem.id
        : null;

      // 2. 调用保存函数
      if (currentTopicId) {
        saveCurrentContent(currentTopicId);
      } else {
        console.log("没有选中任何话题，无法通过 Ctrl+S 保存。");
        showTemporaryStatusMessage("请先选择一个话题再保存。", "orange");
      }
    }
  });

  // --- 新增：处理复选框级联选择和保存状态的事件监听器 (使用事件委托) ---
  sidebar.addEventListener("change", (event) => {
    // 检查事件是否由我们添加的复选框触发
    if (event.target.classList.contains("item-checkbox")) {
      const checkbox = event.target;
      const itemId = checkbox.dataset.itemId;
      const isChecked = checkbox.checked;

      console.log(`Checkbox change: ID=${itemId}, Checked=${isChecked}`);

      // 找到被点击复选框所在的 li 元素
      const parentLi = checkbox.closest("li");
      if (!parentLi) return; // 如果找不到父级 li，则退出

      // --- 递归函数：更新所有后代复选框状态和 selectedItemIds ---
      // (这个函数在监听器内部定义，以便访问 isChecked 和 selectedItemIds)
      function updateDescendants(element, checkedState) {
        // 查找当前元素下的所有直接子 ul 中的复选框
        // 使用 querySelectorAll(':scope > ul .item-checkbox') 查找所有层级的后代更可靠
        const descendantCheckboxes = element.querySelectorAll(".item-checkbox");

        descendantCheckboxes.forEach((descendantCheckbox) => {
          // 避免处理自身 (虽然通常不会选中自身，但以防万一)
          if (descendantCheckbox === checkbox) return;

          const descItemId = descendantCheckbox.dataset.itemId;
          // 检查复选框状态是否需要更新
          if (descendantCheckbox.checked !== checkedState) {
            descendantCheckbox.checked = checkedState; // 更新界面的勾选状态
          }
          // 更新 Set 中的 ID
          if (checkedState) {
            selectedItemIds.add(descItemId);
          } else {
            selectedItemIds.delete(descItemId);
          }
        });
      }

      // --- 主逻辑：更新当前点击的复选框和所有后代 ---
      // 1. 更新当前项的选中状态
      if (isChecked) {
        selectedItemIds.add(itemId);
      } else {
        selectedItemIds.delete(itemId);
      }

      // 2. 更新所有后代的状态
      updateDescendants(parentLi, isChecked);

      // 打印当前选中的 ID 集合 (用于调试)
      console.log("当前选中的 IDs:", Array.from(selectedItemIds));

      // 3. 触发保存选中状态 (将 Set 转为 Array 再发送)
      window.electronAPI.saveSelectionState(Array.from(selectedItemIds));
      console.log("触发保存选中状态...");

      // (可选) 更新父级复选框状态的逻辑可以加在这里，但这会增加复杂度
    }
  });
  // --- 新增监听器结束 ---

  // --- 主要的点击事件监听器 (使用事件委托) ---
  sidebar.addEventListener("click", (event) => {
    const targetElement = event.target; // 获取实际被点击的最精确的元素

    // 1. 检查是否点击了删除按钮 ('X')
    if (targetElement.classList.contains("delete-topic-btn")) {
      // 删除逻辑已经绑定在按钮自身，并通过 stopPropagation 阻止冒泡
      // 这里不需要做额外的选中操作
      console.log("侧边栏监听到删除按钮点击 (应已被内部处理)");
      return;
    }

    // 2. 检查是否点击了添加按钮 ('+')
    if (targetElement.classList.contains("add-topic-btn")) {
      const parentId = targetElement.dataset.parentId;
      if (parentId) {
        currentParentIdInput.value = parentId; // 记录父ID
        addTopicArea.classList.remove("hidden"); // 显示输入区域
        newTopicInput.focus(); // 输入框获取焦点
        console.log(`准备在 ${parentId} 下添加话题 (点击了 '+' 按钮)`);
      }
      return; // 退出，不执行选中逻辑
    }

    // 3. 检查是否点击了输入区域内部 (避免触发选中)
    if (targetElement.closest("#add-topic-area")) {
      console.log("点击在输入区域内部，忽略选中");
      return;
    }

    // 4. 尝试确定被选中的列表项 <li> 及其 ID
    let selectedLi = targetElement.closest("li"); // 找到包含被点击元素的最近的 li

    // 确保找到的 li 是在目录列表内部 (#directory-list) 并且它有 ID
    if (selectedLi && selectedLi.id && selectedLi.closest("#directory-list")) {
      const itemId = selectedLi.id;

      // 查找对应的标题 (如果需要，虽然 displayContent 现在主要用 ID)
      let title = "";
      const textSpan =
        selectedLi.querySelector(".topic-text") ||
        selectedLi.querySelector("span");
      if (textSpan) {
        title = textSpan.textContent.trim();
      } else {
        // 备用方案：获取顶级项 (Part 1/2/3) 的文本
        const firstTextNode = Array.from(selectedLi.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        if (firstTextNode) title = firstTextNode.textContent.trim();
      }

      console.log(`选中了项: ID=${itemId}, Title=${title}`);

      // 更新高亮显示
      updateSelection(selectedLi);
      // 更新右侧内容区域 (传递 ID)
      displayContent(itemId);
    } else {
      // 如果点击的不是有效的列表项 (比如点击了空白区域)
      console.log("点击的不是有效的目录项");
      // 可以选择取消选中状态
      // updateSelection(null);
      // displayContent(null);
    }
  });

  // renderer.js (添加新的 dblclick 监听器)

  sidebar.addEventListener("dblclick", (event) => {
    const targetElement = event.target;

    // 检查双击的是否是动态话题的文本 span
    if (targetElement.classList.contains("topic-text")) {
      const parentLi = targetElement.closest("li.topic-item");
      if (parentLi && parentLi.id) {
        // 如果当前有选中的项，确保它不是正在编辑的项？（可选）
        // if (currentlySelectedItem !== parentLi) {
        //     updateSelection(parentLi); // 可以选择双击时也选中该项
        // }
        switchToEditMode(targetElement, parentLi.id); // 调用切换到编辑模式的函数
      }
    }
    // 不处理静态项或其他元素的双击
  });

  // --- 给输入区域里的 "取消" 按钮添加点击事件 ---
  cancelBtn.addEventListener("click", () => {
    // 直接隐藏输入区域
    hideInputArea();
    console.log("用户取消了添加话题。");
  });

  // --- 初始化显示 (不变) ---
  displayContent(null); // **修改：传递 null**
  console.log("所有事件监听器已添加完毕。"); // 确认脚本执行完毕
});
