lunajson = require "lunajson"
lfs = require "lfs"

function exists(name)
    return os.rename(name, name) and true or false
end

--[[
    Both XET_TABLE.LUA and XET_TABLE_CHARACTER.LUA contain an array of XET objects.
]]
dofile("./XET_TABLE.LUA")
output = io.open("XET_TABLE.json", "w")
output:write(lunajson.encode(XET_TABLE))
output:close()

dofile("./XET_TABLE_CHARACTER.LUA")

output = io.open("XET_TABLE_CHARACTER.json", "w")
output:write(lunajson.encode(XET_TABLE))
output:close()

--[[
    Individual .XET files are stranger. They contain global variables which act as keys for the XET object.
    Set the global environment of the file's compiled function to a table, which will act as the XET object.
    Push the XET object to an array of XET objects, just how XET_TABLE.LUA and XET_TABLE_CHARACTER.LUA
    are layed out.

    NOTE: The .XET files don't seem to be decompiling correctly which is why this is commented out.
]]

--[[
XET_TABLE = {}

if (exists("./XET")) then
    for file in lfs.dir("./XET/") do
        if (file ~= "." and file ~= "..") then
            local xet = {}
            local f = assert(loadfile("./XET/" .. file, _, xet))
            f()

            XET_TABLE[#xet_table] = xet
        end
    end
end

output = io.open("XET_TABLE_OTHER.json", "w")
output:write(lunajson.encode(XET_TABLE))
output:close()
]]
