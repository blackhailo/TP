#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import DSStructure

from webapp2_extras import auth

class AuthInterface():
    def __init__(self):
        self.auth = auth.get_auth()

    def create_user(self, name, email, password):
        user_model = self.auth.store.user_model
        
        success, user = user_model.create_user(email,
                                               name=name,
                                               email_address=email,
                                               password_raw=password)
        
        if success:
            return user.get_id()
        else:
            raise ValueError("Email is already in use")

    def login(self, email, password):
        try:
            user = self.auth.get_user_by_password(email, password, remember=True, save_session=True)
            return user
        except auth.InvalidAuthIdError as err:
            raise ValueError("Invalid email provided")
    
    def logout(self):
        self.auth.unset_session()
        
    def getUser(self):
        user = self.auth.get_user_by_session()
        
        return user
