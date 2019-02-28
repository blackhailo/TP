#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import webapp2
import codecs
import os
import json
import DSStructure

if (os.getenv('SERVER_SOFTWARE') and os.getenv('SERVER_SOFTWARE').startswith('Google App Engine/')):
    ALLOWED_SCHEMES = ['https']
    DEV_FLAG = False
else:
    ALLOWED_SCHEMES = ['http']
    DEV_FLAG = True

class SaveHandler(webapp2.RequestHandler):
    def post(self, PID):
        TPDataString = self.request.POST.get("jsonString")
        DSStructure.insertTP(int(PID), TPDataString)

class UpdateHandler(webapp2.RequestHandler):
    def post(self, PID):
        
        changeType = self.request.POST.get("change_type")
        data = json.loads(self.request.POST.get("data"))
        
        if changeType == "add":
            PID = int(PID)
            NID = DSStructure.getNextNID(PID)
            
            parentID = data.pop("parent_id")
            
            DSStructure.insertTP_v2(PID, NID, parentID) # INSERT NEW NODE
            itemDict = DSStructure.modifyTP(PID, NID, data) # INSERT NODE DATA            
            self.response.write(json.dumps(itemDict))
        elif changeType == "remove":
            NID = data.get("node_id")
            
            DSStructure.removeTP(PID, NID)
            
            itemDict = {"status": True}
            self.response.write(json.dumps(itemDict))
        elif changeType == "modify":
            itemDict = {}
            
            NIDList = data.get("node_id_list", [])
            for nodeID in NIDList:
                itemDict = DSStructure.modifyTP(PID, nodeID, data) # INSERT NODE DATA
            
            self.response.write(json.dumps(itemDict))

class MainHandler(webapp2.RequestHandler):
    def get(self, PID, tileID=None):
        if tileID == None:
            tileID = "1"
            
        TPList = DSStructure.getTP_v2(PID, tileID)
        
        if TPList:
            parentTile = None
            
            for nodeDict in TPList:
                if nodeDict.get("id") == int(tileID):
                    parentTile = nodeDict
                    break
            
            breadCrumbData = DSStructure.resolveTiles(PID, parentTile.get("parent_path"))            
            
            template = self.webtemplate("draft.html")
            template = template.replace("<!--DATA VERSION-->", "1")
            
            template = template.replace("<!--DATA FIELD-->", json.dumps(TPList))
            template = template.replace("<!--CRUMB FIELD-->", json.dumps(breadCrumbData))
            
            self.response.write(template)
        else:
            self.response.write("missing")
    
    def webtemplate(self, template):
        rawHtmlFile = codecs.open(os.path.join("html", template), encoding="utf-8")
        rawHtml = rawHtmlFile.read()
    
        return rawHtml

class OverviewHandler(webapp2.RequestHandler):
    def get(self):
        template = self.webtemplate("newProject.html")
        
        TPList = DSStructure.getTPList()
        
        projectList = ""
        for TPItem in TPList:
            projectList = projectList + '<div class="projectItem"><a href="/%s">%s</a></div>\n' % (TPItem.PID, TPItem.label)
        
        template = template.replace("<!-- PROJECT_LIST -->", projectList)
        
        self.response.write(template)
    
    def webtemplate(self, template):
        rawHtmlFile = codecs.open(os.path.join("html", template), encoding="utf-8")
        rawHtml = rawHtmlFile.read()
    
        return rawHtml
    
class NewHandler(webapp2.RequestHandler):
    def post(self):
        projectName = self.request.POST.get("project_name")
        
        nextPID = DSStructure.getNextPID_v2()
        
        nodeData = {"label": projectName}
        
        DSStructure.insertTP_v2(nextPID, 1, None) # INSERT PARENT NODE
        DSStructure.modifyTP(nextPID, 1, nodeData) # INSERT NODE DATA
        
        self.response.write(nextPID)

class InitHandler(webapp2.RequestHandler):
    def get(self):
        self.response.write("init")
        
        counter = DSStructure.Counter(id="0")
        counter.nextPID = 0
        counter.put()

class HackHandler(webapp2.RequestHandler):
    def get(self):
        DSStructure.hack()
        


app = webapp2.WSGIApplication([
    webapp2.Route('/new', handler=NewHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/update/<:\w+>', handler=UpdateHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/save/<:\w+>', handler=SaveHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/init', handler=InitHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/hack', handler=HackHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/<:\w+>_<:\w+>', handler=MainHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/<:\w+>', handler=MainHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/', handler=OverviewHandler, schemes=ALLOWED_SCHEMES)
], debug=True)




