#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import webapp2
from webapp2_extras import sessions

import codecs
import os
import json
import DSStructure
import authInterface

if (os.getenv('SERVER_SOFTWARE') and os.getenv('SERVER_SOFTWARE').startswith('Google App Engine/')):
    ALLOWED_SCHEMES = ['https']
    DEV_FLAG = False
else:
    ALLOWED_SCHEMES = ['http']
    DEV_FLAG = True
    
### Util
def cleanupParams(rawParamDict, key, formatFunc):
    rawValue = rawParamDict.get(key)
    
    if rawValue:
        return formatFunc(rawValue)
    else:
        raise ValueError("missing key in param dict")

class BaseHandler(webapp2.RequestHandler):
    def dispatch(self):
        # Get a session store for this request.
        self.session_store = sessions.get_store(request=self.request)

        try:
            # Dispatch the request.
            webapp2.RequestHandler.dispatch(self)       # dispatch the main handler
        finally:
            # Save all sessions.
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        # Returns a session using the default cookie key.
        return self.session_store.get_session()
    
    def webtemplate(self, template):
        rawHtmlFile = codecs.open(os.path.join("html", template), encoding="utf-8")
        rawHtml = rawHtmlFile.read()
    
        return rawHtml

class TileHandler(BaseHandler):
    def get(self, rawPID, rawTileID=None):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            try:
                if rawTileID == None:
                    tileID = "1"
                else:
                    tileID = int(rawTileID)
                
                PID = int(rawPID)
                
                TPList = DSStructure.getTP_v2(PID, tileID)
                if TPList:            
                    template = self.webtemplate("tileProjectViewer.html")
                    self.response.write(template)
                else:
                    responseDict = {"status": "failed",
                                    "message": "Missing"}
                
                    self.response.write(json.dumps(responseDict))
            except TypeError:
                responseDict = {"status": "failed",
                                "message": "Invalid ID's supplied"}
                
                self.response.write(json.dumps(responseDict))
        else:
            responseDict = {"status": "failed",
                            "message": unicode("no access")}
        
            self.response.write(json.dumps(responseDict))

## JS MODIFY DATA HANDLERS
class UpdateHandler(BaseHandler):
    def post(self, PID):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            changeType = self.request.POST.get("change_type")
            data = json.loads(self.request.POST.get("data"))
            
            if changeType == "add":
                PID = int(PID)
                NID = DSStructure.getNextNID(PID)
                
                parentID = data.pop("parent_id")
                
                DSStructure.insertTP_v2(PID, NID, parentID) # INSERT NEW NODE
                itemDict = DSStructure.modifyTP(PID, NID, data) # INSERT NODE DATA            
                
                responseDict = {"status": "success",
                                "data": itemDict}
            elif changeType == "remove":
                NID = data.get("node_id")
                
                DSStructure.removeTP(PID, NID)
                
                responseDict = {"status": "success"}
            elif changeType == "modify":
                itemDict = {}
                
                NIDList = data.get("node_id_list", [])
                for nodeID in NIDList:
                    itemDict = DSStructure.modifyTP(PID, nodeID, data) # INSERT NODE DATA
                
                responseDict = {"status": "success",
                                "data": itemDict}
        else:
            responseDict = {"status": "failed",
                            "message": unicode("no access")}
        
        self.response.write(json.dumps(responseDict))

## JS SERVE DATA HANDLERS
class VaultHandler(BaseHandler):
    def get(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            functionString = self.request.GET.get("dataType")
            
            try:
                if functionString == "getTileData":
                    PID = cleanupParams(self.request.GET, "PID", int)
                    parentTileID = cleanupParams(self.request.GET, "parentTileID", int)
                    
                    TPList = DSStructure.getTP_v2(PID, parentTileID)

                    responseDict = {"status": "success",
                                    "data": TPList}
                elif functionString ==  "getTileCrumbData":
                    PID = cleanupParams(self.request.GET, "PID", int)
                    parentTileID = cleanupParams(self.request.GET, "parentTileID", int)
                    
                    parentTile = DSStructure.resolveTiles(PID, [parentTileID])[0]
                    breadCrumbData = DSStructure.resolveTiles(PID, parentTile.get("parent_path"))
                    
                    responseDict = {"status": "success",
                                    "data": breadCrumbData}
                elif functionString == "getUserState":
                    userStateDict = DSStructure.getUserStateDict(1)
                    
                    responseDict = {"status": "success",
                                    "data": userStateDict}
                
            except ValueError as err:
                responseDict = {"status": "failed",
                                "message": unicode(err)}
        else:
            responseDict = {"status": "failed",
                            "message": unicode("no access")}
        
        self.response.write(json.dumps(responseDict))

class UserStateHandler(BaseHandler):
    def post(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            operation = cleanupParams(self.request.POST, "operation", unicode)
            
            if operation == "infoBoxChange":
                data = cleanupParams(self.request.POST, "data", json.loads)
                
                userState = DSStructure.UserState.get_by_id(1)
                userState.userStateDict = data
                
                userState.put()
                responseDict = {"status": "success"}
            else:
                responseDict = {"status": "failed",
                                "message": unicode("operation doesnt exist")}
                
        else:
            responseDict = {"status": "failed",
                            "message": unicode("no access")}
            
        self.response.write(json.dumps(responseDict))
            
##BROWSER FLOW HANDLERS
class LoginHandler(BaseHandler):
    def get(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            return self.redirect("/console")
        else:
            template = self.webtemplate("login.html")
            self.response.write(template)
        
    def post(self):
        try:
            email = cleanupParams(self.request.POST, "email", unicode)
            password = cleanupParams(self.request.POST, "password", unicode)
            
            self.authI = authInterface.AuthInterface()
            self.authI.login(email, password)
            
            responseDict = {"status": "success"}
        except ValueError as err:
            responseDict = {"status": "failed",
                            "message": unicode(err)}
            
        self.response.write(json.dumps(responseDict))

class LogoutHandler(BaseHandler):
    def get(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            self.authI.logout()
            return self.redirect("/")
        else:
            return self.redirect("/")
            

class SignupHandler(BaseHandler):
    def get(self):
        template = self.webtemplate("signup.html")
        self.response.write(template)
        
    def post(self):
        try:
            username = cleanupParams(self.request.POST, "username", unicode)
            email = cleanupParams(self.request.POST, "email", unicode)
            password = cleanupParams(self.request.POST, "password", unicode)
        
            self.authI = authInterface.AuthInterface()
            self.authI.create_user(username, email, password)
            
            responseDict = {"status": "success"}
        except ValueError as err:
            responseDict = {"status": "failed",
                            "message": unicode(err)}
        
        self.response.write(json.dumps(responseDict))
        
class ConsoleHandler(BaseHandler):
    def get(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            template = self.webtemplate("console.html")
            self.response.write(template)
        else:
            return self.redirect("/login")
        
        # TPList = DSStructure.getTPList()
        # 
        # projectList = ""
        # for TPItem in TPList:
        #     projectList = projectList + '<div class="projectItem"><a href="/%s">%s</a></div>\n' % (TPItem.PID, TPItem.label)
        # 
        # template = template.replace("<!-- PROJECT_LIST -->", projectList)
        # 
        # self.session["ged"] = 1
        # value = self.session.get("ged")
        # 
        # self.response.write(value)
        
    # def post(self):
    #     projectName = self.request.POST.get("project_name")
    #     
    #     nextPID = DSStructure.getNextPID_v2()
    #     
    #     nodeData = {"label": projectName}
    #     
    #     DSStructure.insertTP_v2(nextPID, 1, None) # INSERT PARENT NODE
    #     DSStructure.modifyTP(nextPID, 1, nodeData) # INSERT NODE DATA
    #     
    #     self.response.write(nextPID)

class MainHandler(BaseHandler):
    def get(self):
        self.authI = authInterface.AuthInterface()
        activeUser = self.authI.getUser()
        
        if activeUser:
            return self.redirect("/console")
        
        template = self.webtemplate("main.html")
        self.response.write(template)

##ADMIN BACKEND HANDLERS
class InitHandler(BaseHandler):
    def get(self):
        self.response.write("init")
        
        # DSStructure.hack()
        
        counter = DSStructure.Counter(id="0")
        counter.nextPID = 0
        counter.put()


CONFIG = {
  'webapp2_extras.auth': {
    'user_model': 'DSStructure.User',
    'user_attributes': ['email_address', 'name']
  },
  'webapp2_extras.sessions': {
    'secret_key': '22fe0dc5426b9f86848073c2c6f7bb82dabcd24139603c73'
  }
}

app = webapp2.WSGIApplication([
    ##JS ENDPOINTS
    webapp2.Route('/vault', handler=VaultHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/updateUserState', handler=UserStateHandler, schemes=ALLOWED_SCHEMES),
    
    webapp2.Route('/update/<:\w+>', handler=UpdateHandler, schemes=ALLOWED_SCHEMES),
    ##TILEPLANNER MAIN VIEW
    webapp2.Route('/TP/<:\w+>_<:\w+>', handler=TileHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/TP/<:\w+>', handler=TileHandler, schemes=ALLOWED_SCHEMES),
    ##STANDART ENDPOINTS
    webapp2.Route('/login', handler=LoginHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/logout', handler=LogoutHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/signup', handler=SignupHandler, schemes=ALLOWED_SCHEMES),
    webapp2.Route('/console', handler=ConsoleHandler, schemes=ALLOWED_SCHEMES),
    
    ##HACKY ADMIN ENDPOINTS
    webapp2.Route('/init', handler=InitHandler, schemes=ALLOWED_SCHEMES),
    
    ############################
    webapp2.Route('/', handler=MainHandler, schemes=ALLOWED_SCHEMES)
], debug=True, config=CONFIG)




