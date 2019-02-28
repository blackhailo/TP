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
       url: "update/" + TS.PID,
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
         const childList = tileChildren[tile.parentID];
         childList.push(tile);
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
      this.selectedTileIDList.push(tileID);
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
       url: "update/" + TS.PID,
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
   
   success = function(){
       TS.removeParentAsso(target);
       TS.removeCachedTile(originID);
       
       loadData();
   };
   
   removeAjax(originID, success);
}

function acceptEdit(){
   editPromt = $("#editPromt");
   originID = origin.attr("nid");
   
   if (editType == "rename"){
       const inputField = editPromt.children("#editPromtInput");
       const newLabel = inputField.val();
       const tile = TS.getTile(originID);
       tile.label = newLabel;
       
       syncTileData(tile, function(){
           loadData();            
       });
   } else if (editType == "remove"){
       const selectionList = TS.getSelectionList();
       for (let i = 0; i < selectionList.length; i++){
           const cID = selectionList[i];
           removeTile(cID, true);
       }
       
   } else if (editType == "add"){
       inputField = editPromt.children("#editPromtInput");
       newLabel = inputField.val();
       
       $.ajax({
           type: "POST",
           url: "update/" + TS.PID,
           data: {"change_type":"add",
                  "data": JSON.stringify({"parent_id": originID,
                                          "label": newLabel})},
           success: function(response){
               newNodeID = response.id;
               ordering = response.ordering;
               
               TS.setTile(response);
               TS.setParentAsso(TS.tileChildren, TS.getTile(newNodeID));
               
               loadData();
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
   const urlComp = window.location.href;
   originID = origin.attr("nid");
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   window.location.href = urlComp.split("_")[0] + "_" + originID;
}

function reorderFunc(nID, reorderNr){
   function modifyServerTile(tID, orderNr){
       dataComponent = JSON.stringify({
           "node_id_list": [tID],
           "ordering": orderNr
       });
       
       $.ajax({
           type: "POST",
           url: "update/" + TS.PID,
           data: {
               "change_type":"modify",
               "data": dataComponent
               },
           success: function(){
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

function addFunc(originBlock){
   origin = originBlock;
   editType = "add";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}

function renameFunc(originBlock){
   origin = originBlock;
   editType = "rename";
   
   rightClickMenu = $("#clickClickMenu");
   rightClickMenu.css("display", "none");
   
   showEditPromt();
}

function removeFunc(originBlock){
   origin = originBlock;
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
       editHeader.text("Rename");
       editInput.show();
       
       originLabelNode = origin.children(".tile_label ");
       originLabel = originLabelNode.text();
       editInput.val(originLabel);
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
        url: "update/" + TS.PID,
        data: {"change_type":"modify",
               "data": dataComponent
               },
        success: function(){
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
                     ["add", function (){addFunc(originNode);}],
                     ["rename", function (){renameFunc(originNode);}],
                     ["debug", function (){console.log("ged");}]];
   } else {
      /* TILE DROPDOWN */
      contentList = [["Status", "Header"],
                     ["started", function (event){changeStatus(event, 2);}],
                     ["done", function (event){changeStatus(event, 4);}],                                                      
                     ["issues", function (event){changeStatus(event, 3);}],
                     ["default", function (event){changeStatus(event, 1);}],
                     
                     ["Modify", "Header"],
                     ["zoom", function (){zoom(originNode);}],
                     ["add", function (){addFunc(originNode);}],
                     ["rename", function (){renameFunc(originNode);}],
                     ["remove", function (){removeFunc(originNode);}]];
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

function initTP(){
   dataVersion = $('#data_version').val();
   
   if (dataVersion == "1"){
       rawCrumbField = $('#crumb_field').val();
       dataList = JSON.parse(rawCrumbField);
       for (let i=0; i<dataList.length; i++){
           TS.setTile(dataList[i]);
       }
       
       rawDataField = $('#data_field').val();
       dataList = JSON.parse(rawDataField);
       
       for (let i=0; i<dataList.length; i++){
           TS.setTile(dataList[i]);
       }
       
       TS.initParentAsso();
   }
}

function loadData(){
    var renderTileQueue = [];
    
    dataVersion = $('#data_version').val();
 
    /* NEW VERSION */
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
       crumbNode = $('<a href="/' + TS.PID + '_' + curTile.id + '" class="crumbLink">' + curTile.label + '</div>');
       
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

   const childrenList = TS.tileChildren[TS.parentTileID];
   const nrOfSiblings = childrenList.length;
   
   const filterMatchDS = TS.getFilterMatchDS();
   const activeKeyNames = Object.keys(filterMatchDS);
   for (let ithElement = 0; ithElement < nrOfSiblings; ithElement++){
      childTile = childrenList[ithElement];
      
      if (activeKeyNames.length > 0){
         for(let i=0; i < activeKeyNames.length; i++){
            const activeKey = activeKeyNames[i];
            const childFilterKeyValue = childTile[activeKey];
            const allowedValuesSet = filterMatchDS[activeKey];
            
            if (allowedValuesSet.has(childFilterKeyValue)){
               renderTileQueue.push(childTile);
            }
         }
      } else {
         renderTileQueue.push(childTile);
      }
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
   
   const nrOfSiblings = TS.tileChildren[renderTile.parentID].length;
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
      const childrenList = TS.tileChildren[renderTile.id];
      const nrOfChildren = childrenList.length;
      
      const filterMatchDS = TS.getFilterMatchDS();
      const activeKeyNames = Object.keys(filterMatchDS);
      for (let ithElement = 0; ithElement < nrOfChildren; ithElement++){
         childTile = childrenList[ithElement];
         
         if (activeKeyNames.length > 0){
            for(let i=0; i < activeKeyNames.length; i++){
               const activeKey = activeKeyNames[i];
               const childFilterKeyValue = childTile[activeKey];
               const allowedValuesSet = filterMatchDS[activeKey];
               
               if (allowedValuesSet.has(childFilterKeyValue)){
                  renderTileQueue.push(childTile);
               }
            }
         } else {
            renderTileQueue.push(childTile);
         }
      }
   }
}

resizeLayout();
initTP();
loadData();

/* BIND GUI AND UTIL FUNCTIONS */
$("#infoBoxHeader").bind("mousedown", function(event){
   DS.dragInfoBox =  $("#infoBox");
   const oldPos = DS.dragInfoBox.position();
   
   DS.dragStartPos = [oldPos.left, oldPos.top];
   DS.dragStartCursorPos = [event.screenX, event.screenY];
});

$("#infoBoxHeader").bind("mouseup", function(){
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
   
   if (infoBox.css("display") == "none"){
       infoBox.css("display", "block");
   } else {
       infoBox.css("display", "none");
   }
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
       
       DS.dragInfoBox.css({top: newYPos, left: newXPos});
   }
});

$(window).mouseup(function() {
   DS.dragTile = null;
   DS.dragInfoBox = null;
});
