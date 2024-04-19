/*
	Duplicate Composite With Links

	A Toon Boom Harmony shelf script for duplicating selected composite nodes while maintaining the link between the comp and other nodes.
	This script is ideal for tasks that require us to copy comps while maintaining the connection order.
	
	
	Requirement:
	
	Harmony 14 and above
	
	
	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) Add all unzipped files (*.js, and script-icons folder) directly to the folder above.
	4) Add RIG_Duplicate_Composite_With_Links to any toolbar.	

	
	Direction:
	
	1) Select composite nodes you want to duplicate. Any other type of nodes in the selection will be ignored.
	2) Run RIG_Duplicate_Composite_With_Links.

	   
	Author:

		Yu Ueda (raindropmoment.com)
	
*/


var scriptVar = "1.00";


function RIG_Duplicate_Composite_With_Links()
{
	var sNodes = selection.selectedNodes();
	var compList = [];
	
	for (var idx in sNodes)
	{
		if (node.type(sNodes[idx]) == "COMPOSITE" || node.type(sNodes[idx]) == "DeformationCompositeModule")
		{
			compList.push(sNodes[idx]);
		}	
	}
	if (compList.length == 0)
	{
		MessageBox.information("Please select at least one composite.");
		return;
	}

	// make a list of comps that does not have other selected comps as its dst (last comps)
	var lastComps = [];
	for (var idx in compList)
	{
		var isLastComp = true;
		var numOutput = node.numberOfOutputPorts(compList[idx]);
		for (var i = 0; i < numOutput; i++)
		{
			var numOutlinks = node.numberOfOutputLinks(compList[idx], i);			
			for (var ii = 0; ii < numOutlinks; ii++)
			{
				var dst = node.dstNode(compList[idx], i, ii);			
				if (compList.indexOf(dst) !== -1)
				{
					isLastComp = false;
				}
			}
		}
		if (isLastComp)
		{
			lastComps.push(compList[idx]);
		}
	}


	// starting last comps, track up its src comps and add them to sortedCompList
	var sortedCompList = [];
	for (var idx in lastComps)
	{
		if (sortedCompList.indexOf(lastComps[idx]) == -1)
		{
			sortedCompList.push(lastComps[idx]);
		}		

		function scanForSource(curComp)
		{
			var numInput = node.numberOfInputPorts(curComp);
			if (numInput !== 0)
			{
				for (var ii = 0; ii < numInput; ii++)
				{
					var source = node.srcNode(curComp, ii);
					if (compList.indexOf(source) !== -1 && sortedCompList.indexOf(source) == -1)
					{
						sortedCompList.push(source);
						scanForSource(source);
					}
				}
			}				
		}		
		scanForSource(lastComps[idx]);	
	}

	
	scene.beginUndoRedoAccum("Duplicate Composite with Links");


	// make a duplicate of each selected comp first
	var pastedComps = [];
	for (var idx = 0; idx < sortedCompList.length; idx++)
	{
		var sNode = sortedCompList[idx];
		var sNodeType = node.type(sNode);
		var group = node.parentNode(sNode);	
		var newName = node.getName(sNode);
		newName = getUniqueName(newName, group);
		var newComp = node.add(group, newName, sNodeType, node.coordX(sNode) +48, node.coordY(sNode) +48, 0);

		if (sNodeType == "COMPOSITE")
		{
			var compAttrs = ["compositeMode", "flattenOutput", "flattenVector", "composite2d",
							  "composite3d", "outputZ", "outputZInputPort", "applyFocus",
							  "multiplier", "tvgPalette", "mergeVector"]
			
			function setTextAttr(ogNode, newNode, attrName)
			{
				var attr = node.getTextAttr(ogNode, 1, attrName);
				node.setTextAttr(newNode, attrName, 1, attr);
			}
			for (idx2 in compAttrs)
			{
				setTextAttr(sNode, newComp, compAttrs[idx2]);
			}
		}
		
		node.setEnable(newComp, node.getEnable(sNode));		
		node.setLocked(newComp, node.getLocked(sNode));		
		pastedComps.push(newComp);
	}

	// link nodes to the pasted comps
	for (var idx = 0; idx < sortedCompList.length; idx++)
	{
		var sNode = sortedCompList[idx];
		
		var srcNodeList = [];	
		var numInput =  node.numberOfInputPorts(sNode);		
		for (var i = 0; i < numInput; i++)
		{
			var nodeName = node.srcNode(sNode, i);
			var outPort = 0;
			
			var numOutput = node.numberOfOutputPorts(nodeName);
			for (var ii = 0; ii < numOutput; ii++)
			{
				var numOutlinks = node.numberOfOutputLinks(nodeName, ii);			
				for (var iii = 0; iii < numOutlinks; iii++)
				{
					var dst = node.dstNode(nodeName, ii, iii);
					if (dst == sNode)
					{
						outPort = ii;
					}
				}
			}
			for (var ii = 0; ii < sortedCompList.length; ii++)
			{
				if (nodeName == sortedCompList[ii])
				{					
					nodeName = pastedComps[ii];
				}
			}
			srcNodeList.push({src: nodeName, port: outPort});
		}	

		for (var i = 0; i < srcNodeList.length; i++)
		{
			node.link(srcNodeList[i].src, srcNodeList[i].port, pastedComps[idx], i, false, true);
		}
	}
	selection.clearSelection();
	for (var idx in pastedComps)
	{
		selection.addNodeToSelection(pastedComps[idx]);
	}

	
	scene.endUndoRedoAccum();
	
	
	
	function getUniqueName(argName, path)
	{
		var suffix = 0;
		var originalName = argName;
 
		while (node.getName(path + "/" + argName))
		{
			suffix ++;
			argName = originalName + "_" + suffix;	
		}
	
		return argName;
	}
}