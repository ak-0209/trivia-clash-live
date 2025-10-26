const _express = require("express");
const router = _express.Router();

const { getLobby } = require("../controllers/lobbyController");

router.get("/:lobbyId", getLobby);

module.exports = router;
