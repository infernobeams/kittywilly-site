<?php
header("content-type: application/json");
require($_SERVER["DOCUMENT_ROOT"] . "/function.php");
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data["Cookie"]) && !empty($data["Cookie"]))
{
    $result = refresh_cookie($data["Cookie"]);
    if ($result["success"] == false)
    {
        die(json_encode(["success" => false, "msg" => $result["msg"]]));
    } elseif (isset($result["cookie"]) && !empty($result["cookie"]))
    {
        die(json_encode(["success" => true, "msg" => $result["cookie"]]));
    } else
    {
        die(json_encode(["success" => false, "msg" => "Unknown Error"]));
    };
}
else
{
    die(json_encode(["success" => false, "msg" => "Empty Cookie"]));
};
?>