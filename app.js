var richman = require("./richman.js");
var lands = [],
    land, prevLand;
for (var i = 0; i < 10; i++) {
    var land = new richman.land();
    land.name = "land" + i;
    land.price = 100;
    land.planTypes = ["b1"];
    land.banTypes = null;
    land.prevLand = prevLand ? prevLand.name : null;
    lands.push(land);
    prevLand = land;
}
for (var i = 0; i < 10 - 1; i++) {
    lands[i].nextLand = lands[i + 1].name;
}
lands[0].prevLand = lands[lands.length - 1].name;
lands[lands.length - 1].nextLand = lands[0].name;
var buildingTypes = [{
    type: "b1",
    buildCost: [500, 500, 1000],
    customCost: [100, 1000, 1500],
    events: {
        enter: function(p, l) {
            p.pay(l.customCost[l.level-1], true);
        }
    }
}];
var players = [];
for(var i = 0; i< 2;i++){
    var player = new richman.player();
    player.name = "player"+i;
    player.money = 5000;
    players.push(player);
}

var game  = new richman.game(players, lands, buildingTypes);
game.currPlayer().roll().go().done();
console.log(game);
game.currPlayer().roll();
console.log(game);
