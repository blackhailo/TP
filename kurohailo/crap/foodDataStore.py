from google.appengine.ext import ndb

class FoodItems(ndb.Model):
    display = ndb.StringProperty()
    
class Recipes(ndb.Model):
    display = ndb.StringProperty()
    ingredientsList = ndb.KeyProperty(repeated=True)
    howTo = ndb.TextProperty()
    smurfertRating = ndb.IntegerProperty()
    
class ReadyFoodItem(ndb.Model):
    foodType = ndb.KeyProperty()
    amount = ndb.IntegerProperty()
    unit = ndb.StringProperty()