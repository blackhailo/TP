#!/usr/bin/env python
# -*- coding: UTF-8 -*-
from google.appengine.ext import ndb

class Counter(ndb.Model):
    nextPID = ndb.IntegerProperty()
    
class TPStore_v2(ndb.Model):
    PID = ndb.IntegerProperty()
    NID = ndb.IntegerProperty()
    
    status = ndb.IntegerProperty()
    label = ndb.StringProperty()
    
    ordering = ndb.IntegerProperty()
    
    stepCounter = ndb.IntegerProperty()
    parentPath = ndb.IntegerProperty(repeated=True)

def hack():
    gqlString = "SELECT * FROM TPStore_v2"
    
    resultList, cursor, hasMore = runQuery(gqlString, 1000)
    
    for item in resultList:
        item.ordering = 1
        
        item.put()
    

## QUERY
def runQuery(gqlStringQuery, fetchAmount, idOnly=False, cursor=None, projection=None):
	returnQuery = ndb.gql(gqlStringQuery)
	
	#if fetchAmount > 1:
	if cursor:
		resultList, cursor, hasMore = returnQuery.fetch_page(fetchAmount, keys_only=idOnly, start_cursor=cursor, projection=projection)
	else:
		resultList, cursor, hasMore = returnQuery.fetch_page(fetchAmount, keys_only=idOnly, projection=projection)
	
	return resultList, cursor, hasMore


def getTPList():
    gqlString = "SELECT * FROM TPStore_v2 WHERE NID=1"
    
    resultList, cursor, hasMore = runQuery(gqlString, 1000)    
    return resultList

def insertTP(PID, dataDictText):
    putList = []
    TPItem = getTP(PID)
    
    if TPItem == None:
        TPItem = TPStore()
        TPItem.PID = PID
    
    TPItem.rawData = dataDictText
        
    putList.append(TPItem)
    ndb.put_multi(putList)

###V2
def getNextPID_v2():
    counter = Counter.get_by_id("0")
    nextPID = counter.nextPID
    counter.nextPID = nextPID + 1
    counter.put()
    
    return nextPID

def getNextNID(PID):
    gqlString = "SELECT * FROM TPStore_v2 WHERE PID = %s ORDER BY NID desc" % (PID)
    
    resultList, cursor, hasMore = runQuery(gqlString, 1)    
    
    lastNID = 1
    for item in resultList:
        lastNID = item.NID
    
    return lastNID + 1

def parseToJson(item):
    responseItem = {"id": item.NID,
                    "status": item.status,
                    "label": item.label,
                    "parent_path": item.parentPath,
                    "ordering": item.ordering}
    
    return responseItem

def resolveTiles(PID, tileIDList):
    returnData = []
    
    for tileStoreID in map(lambda e: str(PID) + "_" + str(e), tileIDList):
        tileItem = TPStore_v2.get_by_id(tileStoreID)
        returnData.append(parseToJson(tileItem))
        
    return returnData

def getTP_v2(PID, tileID):
    gqlString = "SELECT * FROM TPStore_v2 WHERE PID=%s AND parentPath=%s" % (PID, tileID)
    
    resultList, cursor, hasMore = runQuery(gqlString, 1000)    
    
    if len(resultList) > 0:
        return map(parseToJson, resultList)
    else:
        return None

def insertTP_v2(projectID, nodeID, parentID=None):
    uniqueS = "%s_%s" % (projectID, nodeID)
    TPItem = TPStore_v2(id=uniqueS)
    
    TPItem.PID = projectID
    TPItem.NID = nodeID
    TPItem.ordering = nodeID
    
    TPItem.status = 0
    TPItem.label = ""
    
    if parentID:
        uniqueS = "%s_%s" % (projectID, parentID)
        parentNode = TPStore_v2.get_by_id(uniqueS)
        
        TPItem.stepCounter = parentNode.stepCounter + 1
        itemParentPath = []
        itemParentPath.extend(parentNode.parentPath)
        itemParentPath.append(nodeID)
        
        TPItem.parentPath = itemParentPath
    else:
        TPItem.stepCounter = 1
        TPItem.parentPath = [nodeID]
    
    TPItem.put()
    
def modifyTP(projectID, nodeID, nodeData):
    uniqueS = "%s_%s" % (projectID, nodeID)
    TPItem = TPStore_v2.get_by_id(uniqueS)
    
    for key, value in nodeData.items():
        if hasattr(TPItem, key):
            setattr(TPItem, key, value)
    
    TPItem.put()
    
    return parseToJson(TPItem)

def removeTP(projectID, nodeID):
    uniqueS = "%s_%s" % (projectID, nodeID)
    TPItem = TPStore_v2.get_by_id(uniqueS)
    
    TPItem.key.delete()