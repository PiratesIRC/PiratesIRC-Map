<title>Ship Icons</title>
<table>
<?php
$files = glob("*.*");
for ($i = 0; $i < count($files); $i++) {
    $image = $files[$i];
    $supported_file = array(
        'gif',
        'jpg',
        'jpeg',
        'png'
    );

    $ext = strtolower(pathinfo($image, PATHINFO_EXTENSION));
    if (in_array($ext, $supported_file)) {
      echo "<tr><td>";
		$x = pathinfo($image, PATHINFO_FILENAME); 
		echo "<table border='1'>";
		echo "<tr><td>";
		echo $x;
		echo "</td><td>";
		echo '<img src="' . $image . '" alt="Random image" ,width=100px, height=100px />';
		echo "</td></tr>";
		echo "</table>";
	  
      echo "</td></tr>";
} else {
continue;
}
}
?>
</table>