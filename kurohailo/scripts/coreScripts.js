/**
* BACKEND SYNC
**/
function syncTileData(tile, successFunc){
   dataComponent = JSON.stringify({
       "node_id_list": [tile.id],
       "label": tile.label,
       "status": tile.status,
       "ordering": tile.ordering,
       "parent_path": tile.parentPath
   });
   $.ajax({
       type: "POST",
       url: "../update/" + TS.PID,
       data: {
           "change_type":"modify",
           "data": dataComponent
           },
       success: successFunc,
       dataType: "json"
   });
}

/**
* UTIL FUNCTIONS
**/
function getNIDFromNode(node){
   return parseInt(node.attr("nid"));
}

function findNode(nID){
   return $("div[nid='" + nID + "']");
}

class TileNode {
   constructor(rawTileNode){
       this.id = rawTileNode.id;
       this.label = rawTileNode.label;
       this.status = rawTileNode.status;
       this.ordering = rawTileNode.ordering;
       
       if (rawTileNode.parent_path.length - 2 >= 0){
           this.parentID = rawTileNode.parent_path[rawTileNode.parent_path.length - 2];
       } else {
           this.parentID = null;
       }
       
       this.parentPath = rawTileNode.parent_path;
   }
}

class DragState {
   constructor(){
       this.dragStartPos = null;
       this.dragStartCursorPos = null;
       this.dragInfoBox = null;
       this.dragTile = null;
   }
}

class UserState {
   constructor(){
      this.activeUser = 1;
      this.informationBoxState = {"left": 100,
                                  "top": 100,
                                  "display": "none"};
   }
   
   setUserStateData(stateData){
      const newUserState = {"left": stateData.left,
                            "top": stateData.top,
                            "display": stateData.display}
      
      this.informationBoxState = newUserState;
   }
   
   update(){
      const infoBox = $("#infoBox");
      
      infoBox.css("left", this.informationBoxState.left);
      infoBox.css("top", this.informationBoxState.top);
      infoBox.css("display", this.informationBoxState.display);
   }
}

class TileState {
   constructor(){
       const urlComp = window.location.href.split("/");
       const rawIDs = urlComp[urlComp.length - 1];
       const rawSplitList = rawIDs.split("_");
       
       if (rawSplitList.length == 2){
           this.PID = parseInt(rawSplitList[0]);
           this.parentTileID = parseInt(rawSplitList[1]);
       } else {
           this.PID = parseInt(rawSplitList[0]);
           this.parentTileID = 1;
       }
       this.tileLookup = {};
       this.tileChildren = {};
       this.visableTileChildren = {};
       this.selectedTileIDList = [];
       
       this.tileClipboard = [];
       
       this.filterLookup = {"new":["status", 0],
                            "default":["status", 1],
                            "started":["status", 2],
                            "done":["status", 4],
                            "issues":["status", 3]};
                               
       this.activeFilterList = [];
   }
   
   /* FILTER FUNCS */
   isActiveFilter(filterLabel){
      if (this.activeFilterList.indexOf(filterLabel) == -1){
         return false;
       } else {
         return true;
       }
   }
   getFilterMatchDS(){
      const filterMatchDS = {};
      //new Set();
      for (let i = 0; i < this.activeFilterList.length; i++){
         const activeFilterWord = this.activeFilterList[i];
         const fieldAndValue = this.filterLookup[activeFilterWord];
         const field = fieldAndValue[0];
         const value = fieldAndValue[1];
         
         const bucket = filterMatchDS[field] || new Set();
         bucket.add(value);
         filterMatchDS[fieldAndValue[0]] = bucket;
      }
      return filterMatchDS;
   }
   

   /* TILE FUNCS */
   getTile(tileID){
       return this.tileLookup[tileID];
   }
   
   modifyTile(tileID, attrName, attrValue){
       const currentTile = this.getTile(tileID);
       
       currentTile[attrName] = attrValue;
   }
   
   setTile(tileData){
       const tileNode = new TileNode(tileData);
       this.tileLookup[tileData.id] = tileNode;
       this.tileChildren[tileData.id] = [];
   }
   
   initParentAsso(){
       const tileChildren = this.tileChildren;
       const setParentAsso = this.setParentAsso;            
       Object.values(this.tileLookup).forEach(function(tile){
           setParentAsso(tileChildren, tile);
       });
       
       const reorderFunc = this.recalcTileOrdering;
       Object.values(tileChildren).forEach(function(tileSiblingList){
           reorderFunc(tileSiblingList);
       });
   }
   
   setParentAsso(tileChildren, tile){
      if(tile.parentID !== null){
         try {
            const childList = tileChildren[tile.parentID];
            childList.push(tile);
         } catch (err){
            console.log(tile);
            console.log(err.message);
         }
         
      }
   }
   
   removeParentAsso(tile){            
       const parentChildList = this.tileChildren[tile.parentID];
       
       const indexOfTile = parentChildList.indexOf(tile);            
       if (indexOfTile > -1){
           parentChildList.splice(indexOfTile, 1);
       }
   }
   
   recalcTileOrdering(tileList){
       tileList.sort(function(a, b){
           return a.ordering - b.ordering;
       });
   }
   
   
   removeCachedTile(tileID){
       delete this.tileLookup[tileID];
       delete this.tileChildren[tileID]; 
   }
   
   /* SELECTION */
   getSelectionList(){
       return this.selectedTileIDList;
   }
   
   isTileSelected(tileID) {
      if (this.selectedTileIDList.indexOf(tileID) == -1){
         return false;
      } else {
         return true;
      }
   }
   
   removeTileFromSelection(tileID) {
      if (tileID === this.parentTileID){
         let targetTile = $("#super_tile_indicator");
         targetTile.removeClass("selected");
      } else {
         let targetTile = findNode(tileID);
         targetTile.removeClass("selected");
      }
       
      const selectedTileIDList = this.selectedTileIDList;
      selectedTileIDList.splice(selectedTileIDList.indexOf(tileID), 1);
   }
   
   addTileIDToSelection(tileID) {
      if (tileID === this.parentTileID){
         let targetTile = $("#super_tile_indicator");
         targetTile.addClass("selected");
      } else {
         let targetTile = findNode(tileID);
         targetTile.addClass("selected");
      }
      
      if (this.selectedTileIDList.indexOf(tileID) === -1){
         this.selectedTileIDList.push(tileID);
      }
   }
   
   resetSelectedTiles() {
      while (this.selectedTileIDList.length > 0){
         const cID = this.selectedTileIDList.shift();
         
         if (cID === this.parentTileID){
            let targetTile = $("#super_tile_indicator");
            targetTile.removeClass("selected");
         } else {
            let targetTile = findNode(cID);
            targetTile.removeClass("selected");
         }
      }
   }
   
   /* Util Functions */
   copyToTileClipboard() {
      this.clearTileClipboard();
      
      // only allow cuts on 1 elements atm.
      if(this.selectedTileIDList.length === 1){
         this.tileClipboard = this.selectedTileIDList.slice();
      
         for (let i = 0; i < this.tileClipboard.length; i++){
             const currentNode = findNode(this.tileClipboard[i]);
             
             currentNode.addClass("cutted");
         }
         
         this.resetSelectedTiles();
      }
   }
   
   clearTileClipboard(){
       for (let i = 0; i < this.tileClipboard.length; i++){
           const currentNode = findNode(this.tileClipboard[i]);
           
           currentNode.removeClass("cutted");
       }
       
       this.tileClipboard = [];
   }
}

var origin = null;
var editType = null;

var DS = new DragState();
var TS = new TileState();
var US = new UserState();

function dragInteraction(event){
   if (DS.dragTile && this != DS.dragTile){
       let targetTileID = $(this).attr("nid");
       let targetTile = TS.getTile(targetTileID);
       
       const dragTileID = $(DS.dragTile).attr("nid");
       const dragTile = TS.getTile(dragTileID);
       
       // DRAGGED TO PARENT
       if (dragTile.parentID === targetTile.id){
           let orderNr = 1;
           reorderFunc(dragTileID, orderNr);
       } else {
           const siblingList = TS.tileChildren[dragTile.parentID].map(element => element.id);
           const targeParentPathSet = new Set(targetTile.parentPath);
           const intersection = siblingList.filter(element => targeParentPathSet.has(element));
           
           //IS A SIBLING
           if (intersection.length > 0){
               let orderNr = null;
               targetTileID = intersection[0];
               targetTile = TS.getTile(targetTileID);
               
               if (targetTile.ordering - dragTile.ordering > 0){
                   orderNr = targetTile.ordering + 1;
               } else {
                   orderNr = targetTile.ordering;
               }
               reorderFunc(dragTileID, orderNr);
           }
       }
       DS.dragTile = null;
   }
   
   event.stopPropagation();
}

function removeAjax(targetID, succesFunc) {
   $.ajax({
       type: "POST",
       url: "../update/" + TS.PID,
       data: {"change_type":"remove",
              "data": JSON.stringify({"node_id": targetID})},
       success: succesFunc,
       dataType: "json"
   });
}

function removeTile(originID, reload=false) {
   const target = TS.getTile(originID);
   
   if (target === undefined){
       return;
   }
   
   const childList = TS.tileChildren[originID].slice();
   for (let i=0; i < childList.length; i++){
      childItem = childList[i];
      removeTile(childItem.id)
   }
   
   removeAjax(originID, response => {
      if (response.status === "success"){
         TS.removeParentAsso(target);
         TS.removeCachedTile(originID);
         
         if (reload){
            loadData();
         }
      }
   });
}

function acceptEdit(){
   editPromt = $("#editPromt");
   const selectionList = originSelectionList;
   if (editType == "rename"){
      originID = selectionList[0];
      const inputField = editPromt.children("#editPromtInput");
      const newLabel = inputField.val();
      const tile = TS.getTile(originID);
      tile.label = newLabel;
      
      syncTileData(tile, response => {
         if (response.status === "success"){
            loadData();
         }
      });
   } else if (editType == "remove"){
      for (let i = 0; i < selectionList.length; i++){
         const cID = selectionList[i];
         removeTile(cID, true);
      }
   } else if (editType == "add"){
      originID = selectionList[0];
      inputField = editPromt.children("#editPromtInput");
      newLabel = inputField.val();
      
      $.ajax({
         type: "POST",
         url: "../update/" + TS.PID,
         data: {"change_type":"add",
                "data": JSON.stringify({"parent_id": originID,
                                        "label": newLabel})},
         success: response => {
            if (response.status === "success"){
               const responseData = response.data
               
               newNodeID = responseData.id;
               ordering = responseData.ordering;
               
               TS.setTile(responseData);
               TS.setParentAsso(TS.tileChildren, TS.getTile(newNodeID));
               
               loadData();
            }
         },
         dataType: "json"
      });
   }
   
   origin = null;
   editType = null;
   editPromt.css("display", "None");
}

function cancelEdit(){
   origin = null;
   editType = null;
   editPromt = $("#editPromt");
   editPromt.css("display", "None");
}

function zoom(origin){
   originSelectionList = TS.getSelectionList().slice();
   originID = originSelectionList[0];
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   const newUrl = window.location.origin + "/TP/" + TS.PID + "_" + originID;
   window.location.href = newUrl;
}

function reorderFunc(nID, reorderNr){
   function modifyServerTile(tID, orderNr){
       dataComponent = JSON.stringify({
           "node_id_list": [tID],
           "ordering": orderNr
       });
       
       $.ajax({
           type: "POST",
           url: "../update/" + TS.PID,
           data: {
               "change_type":"modify",
               "data": dataComponent
               },
           dataType: "json"
       });
   }
   
   changedTile = TS.getTile(nID);
   parentTile = TS.getTile(changedTile.parentID);
   
   reorderTileList = TS.tileChildren[changedTile.parentID];
   
   let orderingNrIter = reorderNr + 1;
   for (let i = 0; i < reorderTileList.length; i++){
       tile = reorderTileList[i];
       
       if (tile.id != nID){
           if (tile.ordering >= reorderNr){
               tile.ordering = orderingNrIter;           
               TS.modifyTile(tile.id, "ordering", orderingNrIter);
               modifyServerTile(tile.id, orderingNrIter);
               orderingNrIter = orderingNrIter + 1;
           }
       } else {
           tile.ordering = reorderNr;
           TS.modifyTile(tile.id, "ordering", reorderNr);
           modifyServerTile(tile.id, reorderNr);
       }
   }
   TS.recalcTileOrdering(reorderTileList);
   loadData();
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
}

function addFuncSuperTile(){
   originSelectionList = [TS.parentTileID];
   editType = "add";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}

function addFunc(){
   originSelectionList = TS.getSelectionList().slice();
   editType = "add";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}

function renameFunc(){
   originSelectionList = TS.getSelectionList().slice();
   editType = "rename";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}

function removeFunc(){
   originSelectionList = TS.getSelectionList().slice();
   editType = "remove";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}


function showEditPromt(){
   editPromt = $("#editPromt");
   editHeader = $("#editHeader");
   editInput = $("#editPromtInput");
   
   if (editType == "rename"){
      const originTile = TS.getTile(originSelectionList[0]);
      
      editHeader.text("Rename");
      editInput.show();
      editInput.val(originTile.label);
   } else if (editType == "remove"){
      editHeader.text("Are you sure you want to remove?");
      editInput.hide();
   } else {
       editHeader.text("Add");
       editInput.show();
       editInput.val("");
   }
   
   editPromt.css("display", "block");
   editInput.focus();
}

function changeStatus(event, newStatus){
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   const currentSelection = TS.getSelectionList().slice();
   
   dataComponent = JSON.stringify({
      "node_id_list": currentSelection,
      "status": newStatus
   });
    
   $.ajax({
      type: "POST",
      url: "../update/" + TS.PID,
      data: {"change_type":"modify",
             "data": dataComponent
             },
      success: response => {
         if (response.status === "success"){
            for (let i = 0; i < currentSelection.length; i++){
               const tileID = currentSelection[i];
               const targetTileLookup = TS.getTile(tileID);
               targetTileLookup.status = newStatus;
               const targetTile = findNode(tileID);
               
               let classString = "tile selected";
               if (targetTile.hasClass("small_square")){
                  classString = classString + " small_square";
               }
               
               if (newStatus === 0){
                  classString = classString + " new";
               } else if (newStatus === 1){
                  classString = classString + " default";
               } else if (newStatus === 2){
                  classString = classString + " started";
               } else if (newStatus === 3){
                  classString = classString + " issues";
               } else if (newStatus === 4){
                  classString = classString + " done";
               }
               targetTile.attr("class", classString);    
            }
         } else {
            console.log(response.message)
         }
      },
      dataType: "json"
   });
}

function clickTile(event, originNode){
   const tileID = getNIDFromNode(originNode);
   
   if (event.which == 3){
      if(!TS.isTileSelected(tileID)){
         TS.resetSelectedTiles();
         TS.addTileIDToSelection(tileID);
      }
   } else {
      if (event.shiftKey) {
         TS.addTileIDToSelection(tileID);
      } else if (event.ctrlKey) {
         if (TS.isTileSelected(tileID)){
            TS.removeTileFromSelection(tileID);
         } else {
            TS.addTileIDToSelection(tileID);
         }
      } else {
         TS.resetSelectedTiles();
         TS.addTileIDToSelection(tileID);
      }
   }   
}

function showDropdown(event, originNode){
   const tileID = getNIDFromNode(originNode);
      
   if(tileID !== TS.parentTileID && !TS.isTileSelected(tileID)){
      TS.resetSelectedTiles();
      TS.addTileIDToSelection(tileID);
   }
   
   let leftPos = event.clientX;
   let topPos = event.clientY;
   
   const rightClickMenu = $("#clickClickMenu");
   
   if (rightClickMenu.css("display") != "block"){
       rightClickMenu.css("display", "block");
   }
   
   rightClickMenu.empty();
   
   if (tileID === TS.parentTileID){
      /* SUPER BLOCK DROPDOWN */
      contentList = [["Modify", "Header"],
                     ["add", () => addFuncSuperTile()],
                     ["rename", () => renameFunc()],
                     ["debug", () => console.log("ged")]];
   } else {
      /* TILE DROPDOWN */
      contentList = [["Status", "Header"],
                     ["started", event => changeStatus(event, 2)],
                     ["done", event => changeStatus(event, 4)],
                     ["issues", event => changeStatus(event, 3)],
                     ["default", event => changeStatus(event, 1)],
                     
                     ["Modify", "Header"],
                     ["zoom", () => zoom()],
                     ["add", () => addFunc()],
                     ["rename", () => renameFunc()],
                     ["remove", () => removeFunc()]];
   }
   for (let i = 0; i < contentList.length; i++){
       menuLabel = contentList[i][0];
       menuData = contentList[i][1];
       
       if (menuData == "Header"){
           menuNode = $('<div class="menuHeader">' + menuLabel + '</div>');
       } else {
           menuNode = $('<div class="menuButton">' + menuLabel + '</div>');
           menuNode.bind("click", menuData);
       }
       
       rightClickMenu.append(menuNode);    
   }
   
   superTile = $("#super_tile");
   const rightMostX = leftPos + rightClickMenu.width() + 2;
   const parentSizeX = superTile.width();
   
   if (rightMostX > parentSizeX){
       offsetX = rightMostX - parentSizeX;
       leftPos = leftPos - offsetX;
   }
   
   const bottomMostY = topPos + rightClickMenu.height() + 2;
   const parentSizeY = superTile.height();
   
   if (bottomMostY > parentSizeY){
       offsetY = bottomMostY - parentSizeY;
       topPos = topPos - offsetY;
   }
   
   rightClickMenu.css("left", leftPos);
   rightClickMenu.css("top", topPos);
}

function resizeLayout(){
   windowWidth = window.innerWidth;
   windowHeight = window.innerHeight;
   
   superBlock = $("#super_tile");
   superBlock.width(windowWidth - 1);
   superBlock.height(windowHeight - 1);
   
   let editMargin = 40;
   let editPadding = 20;
   editPromt = $("#editPromt");
   editPromt.width(windowWidth - editMargin * 2 - editPadding * 2);
   
   let moreWidthSize = 178;
   morePanel = $("#morePanel");
   morePanel.css("left", windowWidth - 180);
   morePanel.width(moreWidthSize);
}

function filterChildren(childrenList){
   const filterMatchDS = TS.getFilterMatchDS();
   const activeKeyNames = Object.keys(filterMatchDS);
   
   if (activeKeyNames.length > 0){
      const filteredList = [];
      
      for (let ithElement = 0; ithElement < childrenList.length; ithElement++){
         const childTile = childrenList[ithElement];
         
         for(let i=0; i < activeKeyNames.length; i++){
            const activeKey = activeKeyNames[i];
            const childFilterKeyValue = childTile[activeKey];
            const allowedValuesSet = filterMatchDS[activeKey];
            
            if (allowedValuesSet.has(childFilterKeyValue)){
               filteredList.push(childTile);
               break;
            }
         }
      }
      return filteredList;
   } else {
      return childrenList;
   }
}

function loadData(){
   superTile = $("#super_tile");
   superTile.unbind();
   
   superTile.bind("contextmenu", function(event) {
        showDropdown(event, $(this));
        
        event.preventDefault();
        event.stopPropagation();
   });
   
   superTile.bind("mousedown", function(event) {
      if (event.which != 3){
          rightClickMenu = $("#clickClickMenu");
          rightClickMenu.css("display", "none");
      }
      
      DS.dragTile = null;
      TS.resetSelectedTiles();
      
      event.preventDefault();
      event.stopPropagation();
   });
      
   superTile.bind("mouseup", dragInteraction);
   
   /* EMPTY OLD DATA */
   superTile.children('div').each(
       function(){
           if ($(this).hasClass("tile")){
                   this.remove();
           }
       }
   );
   
   /* LOAD PARENT TILE */
   parentNode = TS.getTile(TS.parentTileID);
   parentPath = parentNode.parentPath;
     
   superTileLabelNode = superTile.children(".tile_label");
   parentLabelNodeList = [];
   for (let i = 0; i < parentPath.length; i++){
       let curPathID = parentPath[i];
       
       const curTile = TS.getTile(curPathID);
       crumbNode = $('<a href="/TP/' + TS.PID + '_' + curTile.id + '" class="crumbLink">' + curTile.label + '</div>');
       
       parentLabelNodeList.push(crumbNode);
       if (i + 1 != parentPath.length){
           parentLabelNodeList.push(" / ");
       }
   }
   
   parentLabel = parentNode.label;
   
   superTileLabelNode.empty();
   superTileLabelNode.append(parentLabelNodeList);
   
   superTile.attr("nid", TS.parentTileID);
   
   superTileIndicator = $("#super_tile_indicator");
   superTileIndicator.unbind();
   superTileIndicator.bind("mousedown", function(event) {
      if (event.which != 3){
          rightClickMenu = $("#clickClickMenu");
          rightClickMenu.css("display", "none");
      }
      
      DS.dragTile = null;
      
      clickTile(event, superTile);
      
      event.preventDefault();
      event.stopPropagation();
   });
    
   if (parentNode.status === 1 || parentNode.parentID === null){
       statusClass = "default";
   } else if (parentNode.status === 0){
       statusClass = "new";
   } else if (parentNode.status === 2){
       statusClass = "started";            
   } else if (parentNode.status === 3){
       statusClass = "issues";
   } else if (parentNode.status === 4) {
       statusClass = "done";
   }
   
   superTileIndicator.addClass(statusClass);
   
   let renderTileQueue = [];
   
   const childrenList = TS.tileChildren[TS.parentTileID];
   const filteredChildrenList = filterChildren(childrenList);
   for (let i=0; i<filteredChildrenList.length; i++){
      renderTileQueue.push(filteredChildrenList[i]);
   }
   
   doSetup = true;
   while (doSetup){
       renderTile = renderTileQueue.shift();
       if (renderTile){
           initBlock(renderTileQueue, renderTile);
       } else {
           doSetup = false;
       }
   }
   
   activeFilterCount = $("#active_filter_count");
   if (TS.activeFilterList.length !== 0) {
     activeFilterCount.text(TS.activeFilterList.length);
     activeFilterCount.css("display", "block");
   } else {
     activeFilterCount.text(0);
     activeFilterCount.css("display", "none");
   }
}

function initBlock(renderTileQueue, renderTile){
   const parentTile = findNode(renderTile.parentID);
   const parentLabel = parentTile.children(".tile_label");
   
   let parentWidth = parentTile.width();
   let parentHeight = parentTile.height() - parentLabel.outerHeight();
   
   const filteredChildrenSiblingList = filterChildren(TS.tileChildren[renderTile.parentID]);
   
   const nrOfSiblings = filteredChildrenSiblingList.length;
   const gridDimensions = Math.ceil(Math.sqrt(nrOfSiblings));
   
   let col = gridDimensions;
   let row = gridDimensions;
   
   if (parentWidth >= parentHeight){
       if (nrOfSiblings <= col * (row - 1)){
           row = row - 1;
       }    
   } else {
       if (nrOfSiblings <= row * (col - 1)){
           col = col - 1;
       }
   }
   
   const usedMargin = 1;
   
   let tileWidthSize = (parentWidth - (col + 1) * usedMargin) / gridDimensions;
   let tileHeightSize = (parentHeight - (row + 1) * usedMargin) / gridDimensions;
   
   if (renderTile.status === 0){
       statusClass = "new";  
   } else if (renderTile.status === 1){
       statusClass = "default";            
   } else if (renderTile.status === 2){
       statusClass = "started";            
   } else if (renderTile.status === 3){
       statusClass = "issues";
   } else if (renderTile.status === 4) {
       statusClass = "done";
   }
   
   const injectTile = $('<div class="tile"></div>');
   injectTile.attr("nid", renderTile.id);
   injectTile.css("margin-left", usedMargin);
   injectTile.css("margin-top", usedMargin);
   
   if (tileWidthSize >= 40 && tileHeightSize >= 40){
       injectTile.append($('<div class="tile_label">' + renderTile.label + '</div>'));
       
       injectTile.css("width", parseInt(tileWidthSize));
       injectTile.css("height", parseInt(tileHeightSize));
   } else {
       injectTile.addClass("small_square");
   } 
   
   injectTile.addClass(statusClass);
   
   parentTile.append(injectTile);
   
   /* BIND TILE FUNCTIONS */
   injectTile.bind("contextmenu", function(event) {
       showDropdown(event, $(this));
       
       event.preventDefault();
       event.stopPropagation();
   });
   
   injectTile.bind("mousedown", function(event) {
       if (event.which != 3){
           rightClickMenu = $("#clickClickMenu");
           rightClickMenu.css("display", "none");
       }
       
       clickTile(event, $(this));
       DS.dragTile = this;
       
       event.preventDefault();
       event.stopPropagation();
   });
  
   injectTile.dblclick(function(event){
      zoom($(this));
      event.stopPropagation();
   });
   
   injectTile.bind("mouseup", dragInteraction);
   
   if (!injectTile.hasClass("small_square")){
      const childrenList = filterChildren(TS.tileChildren[renderTile.id]);
      
      for (let ithElement = 0; ithElement < childrenList.length; ithElement++){
         childTile = childrenList[ithElement];
         renderTileQueue.push(childTile);
      }
   }
}

/*
   USER STATE
*/
function fetchResource(endpoint, params={}){
   return new Promise((resolve, reject) => {
      $.ajax({
      type: "GET",
      url: "../" + endpoint,
      data: params,
      converters: {
         "text json": response => {
            const jsonResponse = JSON.parse(response)
            
            if (jsonResponse.status === "success"){
               return jsonResponse.data  
            } else {
               reject(new Error(jsonResponse.message))
            }
         }
      },
      dataType: "json"
      })
      .done(resolve)
      .fail(reject);
   })
}

async function initTileApp(){
   try {
      let results = await Promise.all([
         fetchResource("vault", {"dataType":"getTileData",
                                 "PID":TS.PID,
                                 "parentTileID":TS.parentTileID}),
         fetchResource("vault", {"dataType":"getTileCrumbData",
                                 "PID":TS.PID,
                                 "parentTileID":TS.parentTileID}),
         fetchResource("vault", {"dataType":"getUserState",
                                 "userID":US.activeUser})
      ])
      
      tileDataList = results[0];
      crumbDataList = results[1];
      userState = results[2];
      
      //INIT USER STATE
      US.setUserStateData(userState)
      US.update();
      
      //INIT TILESTATE
      for (let i=0; i<crumbDataList.length; i++){
          TS.setTile(crumbDataList[i]);
      }
      
      for (let i=0; i<tileDataList.length; i++){
          TS.setTile(tileDataList[i]);
      }
      
      TS.initParentAsso();
      loadData();
      
      $("#loadingOverlay").remove();
   } catch (err){
      if (err.message === "no access"){
         window.location.replace("/login")
      }
   }
}

resizeLayout();
initTileApp();

//var lastname = window.sessionStorage;
//console.log(decodeURIComponent(document.cookie))
//loadUserState();

/* BIND GUI AND UTIL FUNCTIONS */
$("#infoBoxHeader").bind("mousedown", function(event){
   DS.dragInfoBox =  $("#infoBox");
   const oldPos = DS.dragInfoBox.position();
   
   DS.dragStartPos = [oldPos.left, oldPos.top];
   DS.dragStartCursorPos = [event.screenX, event.screenY];
});

$("#button_options").bind("click", function(){
   console.log("options");
});

$("#button_more").bind("click", function(){
   display = $("#morePanel").css("display");
   if (display == "block"){
       $("#morePanel").css("display", "none");
   } else {
       $("#morePanel").css("display", "block");
   }    
});



/* PROMT MODAL FUNCTIONS */
$("#promt_close").bind("click", function(){
   $("#promt_modal").css("display", "none");
});

$("#button_details").bind("click", function(){
   const infoBox = $("#infoBox");
   
   let display = null;
   if (infoBox.css("display") == "none"){
      display = "block";
   } else {
      display = "none";
   }
   
   const left = infoBox.css("left");
   const top = infoBox.css("top");
   
   
   const newInfoBoxState = {"left": left,
                            "top": top,
                            "display": display}
   
   US.informationBoxState = newInfoBoxState;
   
   $.ajax({
      type: "POST",
      url: "../updateUserState",
      data: {
         "operation":"infoBoxChange",
         "data": JSON.stringify(US.informationBoxState)
         },
      success: response => {
         console.log(response)
      },
      dataType: "json"
   });
   
   US.update();
});

$("#button_filter").bind("click", function(){
   const promtModal = $("#promt_modal");
   const promtHeader = $("#promt_header");
   const promtModalContent = $("#promt_content");
   const promtFooter = $("#promt_footer");
   
   if (promtModal.css("display") == "none"){
      // load promt modal
      promtHeader.text("Tags");
      promtModalContent.empty();
      
      filterClickFunc = function(event){
         const filterButton = $(event.target);
         const filterLabel = filterButton.text();
         const filterButtonNode = $(".filter_button#" + filterLabel);
         
         if(filterButtonNode.hasClass("filter_active")){
            filterButtonNode.removeClass("filter_active");
         } else {
            filterButtonNode.addClass("filter_active");
         }
      };
      
      filterWordKeyList = Object.keys(TS.filterLookup);
      for (let i = 0; i < filterWordKeyList.length; i++){
         const filterWord = filterWordKeyList[i];
         const filterButtonTemplate = '<div class="filter_button" id="' + filterWord + '">' + filterWord + '</div>';
         const templateNode = $(filterButtonTemplate);
         
         templateNode.bind("click", filterClickFunc);
         
         if(TS.isActiveFilter(filterWord)){
            templateNode.addClass("filter_active");
         }
         
         promtModalContent.append(templateNode);
      }
      promtModal.css("display", "block");
      
      promtFooter.empty();
      const resetButton = $('<div class="promt_submit" id="filter_reset_button">reset</div>');
      const applyButton = $('<div class="promt_submit" id="filter_apply_button">apply</div>');
      
      resetButton.bind("click", function() {
         TS.activeFilterList = [];
         promtModal.css("display", "none");
         loadData();
      });
      
      applyButton.bind("click", function(){
         const availableFilterNodeList = $(".filter_button");
         const newActiveFilterList = [];
         for (let i = 0; i < availableFilterNodeList.length; i++){
            const currentNode = $(availableFilterNodeList[i]);
            if (currentNode.hasClass("filter_active")){
               newActiveFilterList.push(currentNode.attr("id"));
            }
         }
         
         TS.activeFilterList = newActiveFilterList;
         promtModal.css("display", "none");
         loadData();
      });
      
      promtFooter.append(resetButton);
      promtFooter.append(applyButton);
   } else {
      promtModal.css("display", "none");
   }
});

window.onresize = function() {
   resizeLayout();
   loadData();
};

$(window).keydown(function(event){
   function downAssignParentPath(newParentTile, tile){
       const newParentPath = newParentTile.parentPath.slice();
       newParentPath.push(tile.id);
              
       tile.parentID = newParentTile.id;
       tile.parentPath = newParentPath;
       
       const tileChildren = TS.tileChildren[tile.id];
       for (let i = 0; i < tileChildren.length; i++){
           let childTile = tileChildren[i];
           downAssignParentPath(tile, childTile);
       }
       
       syncTileData(tile);
   }
   
   function cutFunc(){
       TS.copyToTileClipboard();
   }
   
   function pasteFunc(){
       const selectedList = TS.getSelectionList();
       const pasteTargetID = selectedList[0];
       
       const cutIDList = TS.tileClipboard;
       const cutID = cutIDList[0];
       
       const pasteTile = TS.getTile(pasteTargetID);
       const cutTile = TS.getTile(cutID);
       
       if (cutTile === undefined || pasteTile === undefined){
           return;
       }
       
       if (cutTile && pasteTile.id === cutTile.id || pasteTile.id === cutTile.parentID){
           return;
       }
       
       const pasteTileChildren = TS.tileChildren[pasteTargetID];
       
       //remove cutTile from its parent
       TS.removeParentAsso(cutTile);
       
       //backend
       //modify cutTile parentID and parentpath 
       downAssignParentPath(pasteTile, cutTile);
       
       //give new ordering to cutTile
       let newOrdering = 1;
       if (pasteTileChildren.length > 0){
           newOrdering = pasteTileChildren[pasteTileChildren.length - 1].ordering + 1;
       }
       cutTile.ordering = newOrdering;
       
       //add cutTile to pasteTile childList
       TS.setParentAsso(TS.tileChildren, cutTile);
       
       TS.clearTileClipboard();
       
       
       loadData();
   }
   
   //ctrl x cut selection tile
   
   //ctrl v paste selection tile
   hotkeys = {"x": cutFunc,
              "v": pasteFunc};
   
   if (event.ctrlKey && hotkeys[event.key] !== undefined){
       boundFunc = hotkeys[event.key];
       
       if (boundFunc){
           boundFunc();
       }
   }
});

$(window).keyup(function(event){
   if (event.which == 46){
      removeFunc();
   }
});

$(window).keypress(function(event){
   if (event.which == 13){
       editPromt = $("#editPromt");
       if (editPromt.css("display") == "block"){
           acceptEdit();
       }
   }
});

$(window).mousemove(function(event) {
   if(DS.dragInfoBox){
      deltaX = event.screenX - DS.dragStartCursorPos[0];
      deltaY = event.screenY - DS.dragStartCursorPos[1];
      
      let newXPos = DS.dragStartPos[0] + deltaX;
      let newYPos = DS.dragStartPos[1] + deltaY;
      
      const infoBoxWidth = DS.dragInfoBox.outerWidth();
      const infoBoxHeight = DS.dragInfoBox.outerHeight();
      
      superTile = $("#super_tile");
      const rightMostX = superTile.width();
      const bottomMostY = superTile.height();
      //let parentSizeX = ;  
      
      if (newXPos < 0){
          newXPos = 0;
      } else  if (newXPos + infoBoxWidth > rightMostX){
          newXPos = rightMostX - infoBoxWidth;
      }
      if (newYPos < 0){
          newYPos = 0;
      } else  if (newYPos + infoBoxHeight > bottomMostY){
          newYPos = bottomMostY - infoBoxHeight;
      }
            
      DS.dragInfoBox.css({left: newXPos, top: newYPos});
   }
});

$(window).mouseup(function() {
   if (DS.dragInfoBox){
      const left = DS.dragInfoBox.css("left")
      const top = DS.dragInfoBox.css("top")
      const isShown = DS.dragInfoBox.css("display")
      
      const newInfoBoxState = {"left": left,
                               "top": top,
                               "display": isShown}
      
      US.informationBoxState = newInfoBoxState;
      
      $.ajax({
         type: "POST",
         url: "../updateUserState",
         data: {
            "operation":"infoBoxChange",
            "data": JSON.stringify(US.informationBoxState)
            },
         success: response => console.log(response),
         dataType: "json"
      });
      
      US.update();
   }
   
   DS.dragTile = null;
   DS.dragInfoBox = null;
});
